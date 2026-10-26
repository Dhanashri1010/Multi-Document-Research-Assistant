import mongoose from 'mongoose';
import { config } from '../config/env.js';

let checked = false;
let available = false;

export async function checkMongoAvailability(): Promise<boolean> {
  if (checked) return available;
  try {
    const conn = await mongoose.createConnection(config.mongoUri, {
      serverSelectionTimeoutMS: 2000,
    }).asPromise();
    await conn.close();
    available = true;
  } catch (err: any) {
    available = false;
    console.warn(`[MongoHelper] MongoDB connection check failed: ${err.message}. DB-dependent tests will be skipped.`);
  }
  checked = true;
  return available;
}
