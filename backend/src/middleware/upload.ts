import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['application/pdf', 'text/plain'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || ext === '.pdf' || ext === '.txt') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only PDF and TXT research documents are supported.'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMB * 1024 * 1024,
  },
});
