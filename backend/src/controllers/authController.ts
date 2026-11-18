import { Request, Response } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { signToken } from '../utils/jwt.js';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100),
  email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const validated = registerSchema.safeParse(req.body);
      if (!validated.success) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: validated.error.issues[0]?.message || 'Invalid input data',
        });
        return;
      }

      const { name, email, password } = validated.data;

      // Check if email already registered
      const existing = await UserModel.findOne({ email });
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'An account with this email address already exists. Please log in.',
        });
        return;
      }

      // Hash password & save user
      const passwordHash = await UserModel.hashPassword(password);
      const user = await UserModel.create({
        name,
        email,
        passwordHash,
      });

      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      console.error('[AuthController] Registration error:', err);
      res.status(500).json({
        success: false,
        error: 'Registration Failed',
        message: 'An error occurred while creating your account. Please try again.',
      });
    }
  }

  /**
   * Log in an existing user
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validated = loginSchema.safeParse(req.body);
      if (!validated.success) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: validated.error.issues[0]?.message || 'Invalid input data',
        });
        return;
      }

      const { email, password } = validated.data;

      const user = await UserModel.findOne({ email });
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid Credentials',
          message: 'Incorrect email address or password. Please try again.',
        });
        return;
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: 'Invalid Credentials',
          message: 'Incorrect email address or password. Please try again.',
        });
        return;
      }

      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      console.error('[AuthController] Login error:', err);
      res.status(500).json({
        success: false,
        error: 'Login Failed',
        message: 'An error occurred while logging in. Please try again.',
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required.',
        });
        return;
      }

      const user = await UserModel.findById(req.user.userId).select('-passwordHash');
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User Not Found',
          message: 'User account could not be found.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      console.error('[AuthController] GetMe error:', err);
      res.status(500).json({
        success: false,
        error: 'Profile Error',
        message: 'Failed to retrieve user profile.',
      });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  static async logout(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

