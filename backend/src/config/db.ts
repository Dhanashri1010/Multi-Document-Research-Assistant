import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri);
    console.log(`[Database] Connected to MongoDB at ${config.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
