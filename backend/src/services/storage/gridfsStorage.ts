import mongoose from 'mongoose';
import { Readable } from 'stream';

let gridFsBucket: mongoose.mongo.GridFSBucket | null = null;

/**
 * Returns the active MongoDB GridFSBucket using the current mongoose connection.
 */
export function getGridFSBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not established for GridFS operations.');
  }
  if (!gridFsBucket) {
    gridFsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'document_files',
    });
  }
  return gridFsBucket;
}

/**
 * Uploads a document buffer into MongoDB GridFS and returns the stored file ID string.
 */
export async function uploadToGridFS(
  filename: string,
  buffer: Buffer,
  contentType: string = 'application/pdf'
): Promise<string> {
  const bucket = getGridFSBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
    });
    uploadStream.on('error', (err) => {
      console.error('[GridFS] Upload error:', err);
      reject(err);
    });
    uploadStream.on('finish', () => {
      console.log(`[GridFS] Persisted "${filename}" (ID: ${uploadStream.id}) to MongoDB GridFS.`);
      resolve(uploadStream.id.toString());
    });
    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}

/**
 * Streams a document file from MongoDB GridFS back into a Buffer.
 */
export async function downloadFromGridFS(fileIdStr: string): Promise<Buffer> {
  const bucket = getGridFSBucket();
  const id = new mongoose.Types.ObjectId(fileIdStr);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(id);
    downloadStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    downloadStream.on('error', (err) => {
      console.error(`[GridFS] Download error for ID ${fileIdStr}:`, err);
      reject(err);
    });
    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

/**
 * Deletes a file from MongoDB GridFS.
 */
export async function deleteFromGridFS(fileIdStr: string): Promise<void> {
  try {
    const bucket = getGridFSBucket();
    const id = new mongoose.Types.ObjectId(fileIdStr);
    await bucket.delete(id);
    console.log(`[GridFS] Deleted file ID ${fileIdStr} from MongoDB GridFS.`);
  } catch (err: any) {
    console.warn(`[GridFS] Delete warning for file ID ${fileIdStr}: ${err.message}`);
  }
}
