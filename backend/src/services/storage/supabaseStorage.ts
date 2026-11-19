import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/env.js';
import { IDocument } from '../../models/Document.js';
import { uploadToGridFS, downloadFromGridFS, deleteFromGridFS } from './gridfsStorage.js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  if (config.supabaseUrl && config.supabaseServiceKey) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log('[StorageService] Supabase Storage client initialized successfully.');
    } catch (err) {
      console.warn('[StorageService] Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  }

  return supabaseClient;
}

export class StorageService {
  private static isBucketVerified = false;

  /**
   * Resets the in-memory bucket verification cache (useful in tests).
   */
  static resetBucketCache(): void {
    this.isBucketVerified = false;
  }

  /**
   * Check if Supabase cloud storage is actively configured.
   */
  static isCloudStorageEnabled(): boolean {
    return Boolean(config.supabaseUrl && config.supabaseServiceKey);
  }

  /**
   * Ensures the private Supabase storage bucket exists with in-memory caching.
   * Caches successful verification so subsequent uploads skip redundant listBuckets() calls.
   * Failures are never cached so subsequent attempts can re-try.
   */
  static async ensureBucket(): Promise<boolean> {
    if (this.isBucketVerified) {
      return true;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        this.isBucketVerified = false;
        console.warn('[StorageService] Could not list Supabase buckets:', error.message);
        return false;
      }

      const bucketName = config.supabaseBucket;
      const exists = buckets?.some((b) => b.name === bucketName);

      if (!exists) {
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: config.maxFileSizeMB * 1024 * 1024,
        });
        if (createError) {
          this.isBucketVerified = false;
          console.warn('[StorageService] Could not create bucket:', createError.message);
          return false;
        }
        console.log(`[StorageService] Created private bucket "${bucketName}".`);
      }

      this.isBucketVerified = true;
      return true;
    } catch (err: any) {
      this.isBucketVerified = false;
      console.warn('[StorageService] Bucket check failed:', err.message);
      return false;
    }
  }

  /**
   * Saves an uploaded document buffer to Supabase (if configured), MongoDB GridFS (durable), or local disk.
   */
  static async saveDocumentFile(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    documentId: string,
    mimeType: string
  ): Promise<{ storageProvider: 'supabase' | 'local' | 'gridfs'; storagePath: string; localPath: string }> {
    const uploadDir = path.resolve(process.cwd(), config.uploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const localFilename = `${Date.now()}-${documentId}-${sanitized}`;
    const localPath = path.join(uploadDir, localFilename);

    // Always write to local path for immediate extraction worker
    await fs.promises.writeFile(localPath, fileBuffer);

    const supabase = getSupabaseClient();

    // 1. Supabase Storage (if configured)
    if (config.storageProvider === 'supabase') {
      if (supabase) {
        try {
          await this.ensureBucket();
          const cloudPath = `${userId}/${documentId}-${sanitized}`;

          const { error } = await supabase.storage
            .from(config.supabaseBucket)
            .upload(cloudPath, fileBuffer, {
              contentType: mimeType,
              upsert: true,
            });

          if (!error) {
            console.log(`[StorageService] Uploaded document to Supabase Storage: "${cloudPath}"`);
            return {
              storageProvider: 'supabase',
              storagePath: cloudPath,
              localPath,
            };
          } else {
            console.warn(`[StorageService] Supabase upload error: ${error.message}.`);
            await fs.promises.unlink(localPath).catch(() => {});
            throw new Error(`Persistent cloud storage upload failed: ${error.message}.`);
          }
        } catch (cloudErr: any) {
          console.warn(`[StorageService] Supabase storage exception: ${cloudErr.message}.`);
          await fs.promises.unlink(localPath).catch(() => {});
          throw cloudErr;
        }
      } else {
        await fs.promises.unlink(localPath).catch(() => {});
        throw new Error(
          'Cloud storage is required in production (SUPABASE_URL and SUPABASE_SERVICE_KEY). Ephemeral disk fallback is disabled to prevent data loss.'
        );
      }
    }

    // 2. MongoDB GridFS (durable storage across Render container restarts, zero extra credentials)
    if (config.storageProvider === 'gridfs') {
      try {
        const gridFsId = await uploadToGridFS(
          `${documentId}-${sanitized}`,
          fileBuffer,
          mimeType
        );
        return {
          storageProvider: 'gridfs',
          storagePath: gridFsId,
          localPath,
        };
      } catch (gridErr: any) {
        console.warn(`[StorageService] GridFS upload error: ${gridErr.message}. Falling back to local disk.`);
      }
    }

    return {
      storageProvider: 'local',
      storagePath: localPath,
      localPath,
    };
  }

  /**
   * Retrieves the raw document Buffer for reading, parsing, or downloading.
   */
  static async getDocumentBuffer(doc: IDocument): Promise<Buffer> {
    // 1. Try local disk first if present
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      return fs.promises.readFile(doc.filePath);
    }

    // 2. Fetch from MongoDB GridFS if stored in database
    if (doc.storageProvider === 'gridfs' && doc.storagePath) {
      try {
        return await downloadFromGridFS(doc.storagePath);
      } catch (gridErr: any) {
        console.warn(`[StorageService] GridFS download failed for ${doc.originalName}: ${gridErr.message}`);
      }
    }

    // 3. Fetch from Supabase if stored in cloud
    if (doc.storageProvider === 'supabase' && doc.storagePath) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.storage
          .from(config.supabaseBucket)
          .download(doc.storagePath);

        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
        throw new Error(`Failed to download file from Supabase Storage: ${error?.message || 'Unknown error'}`);
      }
    }

    throw new Error(`Document file not found on disk, GridFS, or cloud storage (${doc.originalName}).`);
  }

  /**
   * Deletes a document file from cloud storage, GridFS, and local disk.
   */
  static async deleteDocumentFile(doc: IDocument): Promise<void> {
    // Delete from MongoDB GridFS
    if (doc.storageProvider === 'gridfs' && doc.storagePath) {
      await deleteFromGridFS(doc.storagePath);
    }

    // Delete from Supabase
    if (doc.storageProvider === 'supabase' && doc.storagePath) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.storage.from(config.supabaseBucket).remove([doc.storagePath]);
          console.log(`[StorageService] Removed "${doc.storagePath}" from Supabase bucket.`);
        } catch (err: any) {
          console.warn('[StorageService] Error deleting file from Supabase:', err.message);
        }
      }
    }

    // Delete from local disk
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        await fs.promises.unlink(doc.filePath);
      } catch (err: any) {
        console.warn('[StorageService] Error unlinking local file:', err.message);
      }
    }
  }
}

