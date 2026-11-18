import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export interface AuthUserPayload {
  userId: string;
  email: string;
  name: string;
}

export function signToken(payload: AuthUserPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresIn as any });
}

export function verifyToken(token: string): AuthUserPayload {
  return jwt.verify(token, config.jwtSecret) as AuthUserPayload;
}

