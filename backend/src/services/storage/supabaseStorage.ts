import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/env.js';
import { IDocument } from '../../models/Document.js';

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
  /**
   * Check if Supabase cloud storage is actively configured.
   */
  static isCloudStorageEnabled(): boolean {
    return Boolean(config.supabaseUrl && config.supabaseServiceKey);
  }

  /**
   * Ensures the private Supabase storage bucket exists.
   */
  static async ensureBucket(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
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
          console.warn('[StorageService] Could not create bucket:', createError.message);
          return false;
        }
        console.log(`[StorageService] Created private bucket "${bucketName}".`);
      }

      return true;
    } catch (err: any) {
      console.warn('[StorageService] Bucket check failed:', err.message);
      return false;
    }
  }

  /**
   * Saves an uploaded document buffer to Supabase (if configured) and/or local disk.
   */
  static async saveDocumentFile(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    documentId: string,
    mimeType: string
  ): Promise<{ storageProvider: 'supabase' | 'local'; storagePath: string; localPath: string }> {
    const uploadDir = path.resolve(process.cwd(), config.uploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const localFilename = `${Date.now()}-${documentId}-${sanitized}`;
    const localPath = path.join(uploadDir, localFilename);

    // Always write to local path for extraction worker
    await fs.promises.writeFile(localPath, fileBuffer);

    const isCloudRequired = config.storageProvider === 'supabase' || config.nodeEnv === 'production';
    const supabase = getSupabaseClient();

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
          if (isCloudRequired) {
            await fs.promises.unlink(localPath).catch(() => {});
            throw new Error(`Persistent cloud storage upload failed: ${error.message}. Cloud storage is required in production to prevent ephemeral file loss.`);
          }
        }
      } catch (cloudErr: any) {
        console.warn(`[StorageService] Supabase storage exception: ${cloudErr.message}.`);
        if (isCloudRequired) {
          await fs.promises.unlink(localPath).catch(() => {});
          throw cloudErr;
        }
      }
    } else if (isCloudRequired) {
      await fs.promises.unlink(localPath).catch(() => {});
      throw new Error(
        'Cloud storage is required in production (SUPABASE_URL and SUPABASE_SERVICE_KEY). Ephemeral disk fallback is disabled to prevent data loss.'
      );
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

    // 2. Fetch from Supabase if stored in cloud
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

    throw new Error(`Document file not found on disk or cloud storage (${doc.originalName}).`);
  }

  /**
   * Deletes a document file from cloud storage and local disk.
   */
  static async deleteDocumentFile(doc: IDocument): Promise<void> {
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

