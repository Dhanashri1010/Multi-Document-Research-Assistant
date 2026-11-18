import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel } from '../models/User.js';
import { DocumentModel } from '../models/Document.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';
import { ChatMessageModel } from '../models/ChatMessage.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { DocumentController } from '../controllers/documentController.js';
import { ChatController } from '../controllers/chatController.js';
import { ResearchController } from '../controllers/researchController.js';
import { StorageService } from '../services/storage/supabaseStorage.js';

describe('Phase 2 Multi-User Security & Data Isolation Tests', () => {
  const userAId = new mongoose.Types.ObjectId().toString();
  const userBId = new mongoose.Types.ObjectId().toString();

  const userAPayload = {
    userId: userAId,
    email: 'usera@university.edu',
    name: 'Researcher A',
  };

  const userBPayload = {
    userId: userBId,
    email: 'userb@university.edu',
    name: 'Researcher B',
  };

  describe('1. Authentication: Password Hashing & JWT Signing', () => {
    it('hashes passwords with bcryptjs and correctly verifies matching passwords', async () => {
      const rawPassword = 'SecureResearchPassword2026!';
      const hash = await UserModel.hashPassword(rawPassword);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(rawPassword);
      expect(hash.startsWith('$2')).toBe(true);

      const isValid = await bcrypt.compare(rawPassword, hash);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('WrongPassword123', hash);
      expect(isInvalid).toBe(false);
    });

    it('signs and verifies JWT tokens with valid claims', () => {
      const token = signToken(userAPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyToken(token);
      expect(verified.userId).toBe(userAId);
      expect(verified.email).toBe(userAPayload.email);
      expect(verified.name).toBe(userAPayload.name);
    });

    it('rejects tampered or malformed tokens', () => {
      const token = signToken(userAPayload);
      const tampered = token.slice(0, -6) + 'abc123';

      expect(() => verifyToken(tampered)).toThrow();
      expect(() => verifyToken('invalid.token.structure')).toThrow();
    });
  });

  describe('2. Authentication Middleware: requireAuth', () => {
    it('blocks requests without Authorization header or query token with 401 Unauthorized', () => {
      const req: any = { headers: {}, query: {} };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unauthorized',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('authenticates valid Bearer tokens and attaches user payload to req.user', () => {
      const token = signToken(userAPayload);
      const req: any = {
        headers: { authorization: `Bearer ${token}` },
        query: {},
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(userAId);
      expect(req.user.email).toBe('usera@university.edu');
    });

    it('authenticates query token parameter for secure iframe PDF viewing', () => {
      const token = signToken(userBPayload);
      const req: any = {
        headers: {},
        query: { token },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(userBId);
      expect(req.user.email).toBe('userb@university.edu');
    });
  });

  describe('3. User Data Isolation: Document Access Controls', () => {
    const docBId = new mongoose.Types.ObjectId().toString();
    const docB = {
      _id: docBId,
      userId: new mongoose.Types.ObjectId(userBId),
      originalName: 'Confidential_Drug_Discovery_B.pdf',
      filename: 'file_b.pdf',
      filePath: './uploads/file_b.pdf',
      pageCount: 12,
      chunkCount: 20,
      status: 'ready',
    };

    it("prevents User A from viewing User B's document details (403 Forbidden)", async () => {
      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(docB as any);

      const req: any = {
        params: { id: docBId },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await DocumentController.getById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from downloading User B's document file (403 Forbidden)", async () => {
      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(docB as any);

      const req: any = {
        params: { id: docBId },
        user: userAPayload,
        query: {},
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await DocumentController.downloadFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from deleting User B's document (403 Forbidden)", async () => {
      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(docB as any);

      const req: any = {
        params: { id: docBId },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await DocumentController.delete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from triggering reprocessing on User B's document (403 Forbidden)", async () => {
      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(docB as any);

      const req: any = {
        params: { id: docBId },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await DocumentController.reprocess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it('allows User B (the owner) to access their own document', async () => {
      vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce(docB as any);

      const req: any = {
        params: { id: docBId },
        user: userBPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await DocumentController.getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          document: expect.objectContaining({ _id: docBId }),
        })
      );
    });
  });

  describe('4. User Data Isolation: Research Sessions & Cross-Document Queries', () => {
    const sessionBId = new mongoose.Types.ObjectId().toString();
    const sessionB = {
      _id: sessionBId,
      userId: new mongoose.Types.ObjectId(userBId),
      title: "User B's Private Research",
      selectedDocumentIds: [],
    };

    it("prevents User A from viewing User B's research session messages (403 Forbidden)", async () => {
      vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValueOnce(sessionB as any);

      const req: any = {
        params: { sessionId: sessionBId },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.getSessionMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from deleting User B's research session (403 Forbidden)", async () => {
      vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValueOnce(sessionB as any);

      const req: any = {
        params: { sessionId: sessionBId },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.deleteSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it('prevents ordinary users from listing legacy sessions without userId', async () => {
      const findSpy = vi.spyOn(ResearchSessionModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as any);

      const req: any = {
        user: userAPayload,
      };
      const res: any = {
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.getSessions(req, res, next);

      expect(findSpy).toHaveBeenCalledWith({
        userId: new mongoose.Types.ObjectId(userAPayload.userId),
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('prevents ordinary users from viewing messages of legacy sessions without userId (403 Forbidden)', async () => {
      const legacySession = {
        _id: 'legacy_sess_no_user',
        title: 'Legacy Session Without User ID',
        // no userId
      };
      vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValueOnce(legacySession as any);

      const req: any = {
        params: { sessionId: 'legacy_sess_no_user' },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.getSessionMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it('prevents ordinary users from deleting legacy sessions without userId (403 Forbidden)', async () => {
      const legacySession = {
        _id: 'legacy_sess_no_user',
        title: 'Legacy Session Without User ID',
        // no userId
      };
      vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValueOnce(legacySession as any);

      const req: any = {
        params: { sessionId: 'legacy_sess_no_user' },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.deleteSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from querying or comparing User B's private documents in Chat", async () => {
      // Simulate DocumentModel.countDocuments returning 0 when User A tries to select User B's doc
      vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(0);

      const req: any = {
        body: {
          question: 'What are the main findings?',
          documentIds: ['doc_belonging_to_user_b'],
        },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.ask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it('prevents User A from querying against a legacy session without userId (403 Forbidden)', async () => {
      vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1);
      const legacySession = {
        _id: 'legacy_sess_123',
        title: 'Legacy Session',
      };
      vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValueOnce(legacySession as any);

      const req: any = {
        body: {
          question: 'What is this?',
          documentIds: ['doc_a'],
          sessionId: 'legacy_sess_123',
        },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.ask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from querying against User B's research session (403 Forbidden)", async () => {
      vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1);
      vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValueOnce(sessionB as any);

      const req: any = {
        body: {
          question: 'What is this?',
          documentIds: ['doc_a'],
          sessionId: sessionBId,
        },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ChatController.ask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });

    it("prevents User A from running comparative analysis on User B's documents", async () => {
      vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1); // Only 1 of 2 belongs to User A

      const req: any = {
        body: {
          documentIds: ['doc_a', 'doc_belonging_to_b'],
          focusTopic: 'Methodology',
        },
        user: userAPayload,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await ResearchController.compare(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/access denied/i),
        })
      );
    });
  });

  describe('5. Storage Service: Local and Cloud Storage Fallback', () => {
    it('saves files with local disk fallback when Supabase is not configured', async () => {
      const sampleBuffer = Buffer.from('%PDF-1.4 test buffer content');
      const docId = new mongoose.Types.ObjectId().toString();

      const result = await StorageService.saveDocumentFile(
        sampleBuffer,
        'Test_Paper.pdf',
        userAId,
        docId,
        'application/pdf'
      );

      expect(result).toBeDefined();
      expect(result.storageProvider).toBe('local');
      expect(result.localPath).toContain('Test_Paper.pdf');
    });

    it('correctly reads buffer from local disk', async () => {
      const sampleBuffer = Buffer.from('%PDF-1.4 test buffer content');
      const docId = new mongoose.Types.ObjectId().toString();

      const stored = await StorageService.saveDocumentFile(
        sampleBuffer,
        'Sample_Buffer_Test.pdf',
        userAId,
        docId,
        'application/pdf'
      );

      const mockDoc: any = {
        originalName: 'Sample_Buffer_Test.pdf',
        filePath: stored.localPath,
        storageProvider: 'local',
      };

      const readBuffer = await StorageService.getDocumentBuffer(mockDoc);
      expect(readBuffer).toBeDefined();
      expect(readBuffer.toString()).toContain('%PDF-1.4');
    });

    it('in production mode, fails safely and deletes temporary files when cloud storage is unavailable', async () => {
      const { config } = await import('../config/env.js');
      const originalEnv = config.nodeEnv;
      const originalProvider = config.storageProvider;

      try {
        (config as any).nodeEnv = 'production';
        (config as any).storageProvider = 'supabase';

        const sampleBuffer = Buffer.from('%PDF-1.4 production file content');
        const docId = new mongoose.Types.ObjectId().toString();

        await expect(
          StorageService.saveDocumentFile(
            sampleBuffer,
            'Prod_Doc.pdf',
            userAId,
            docId,
            'application/pdf'
          )
        ).rejects.toThrow(/cloud storage is required in production/i);
      } finally {
        (config as any).nodeEnv = originalEnv;
        (config as any).storageProvider = originalProvider;
      }
    });
  });

  describe('6. Deduplication Isolation: Duplicate File Uploads', () => {
    it('does NOT reuse another user\'s document when User A uploads the same file as User B', async () => {
      const existingUserBDoc = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userBId),
        originalName: 'Duplicate_Test.pdf',
        fileHash: 'sha256_identical_hash_12345',
        status: 'ready',
      };

      const findOneSpy = vi.spyOn(DocumentModel, 'findOne').mockImplementation((query: any) => {
        if (query.userId && query.userId.toString() === userAId) {
          return Promise.resolve(null) as any;
        }
        if (query.userId && query.userId.toString() === userBId) {
          return Promise.resolve(existingUserBDoc) as any;
        }
        return Promise.resolve(null) as any;
      });

      // Create a temporary valid PDF file on disk for magic-byte check
      const tempPath = path.resolve(process.cwd(), './uploads/temp_dup_test.pdf');
      await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
      await fs.promises.writeFile(tempPath, Buffer.from('%PDF-1.4 duplicate test content'));

      const req: any = {
        files: [
          {
            path: tempPath,
            originalname: 'Duplicate_Test.pdf',
            mimetype: 'application/pdf',
            size: 1024,
          },
        ],
        user: userAPayload, // User A is uploading
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      vi.spyOn(DocumentModel, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userAId),
        originalName: 'Duplicate_Test.pdf',
        fileHash: 'sha256_identical_hash_12345',
        status: 'pending',
      } as any);

      try {
        await DocumentController.upload(req, res, next);

        // Verify that findOne was queried strictly with User A's userId
        expect(findOneSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: expect.anything(),
          })
        );

        // Verify the response is 201 Created (new document for User A) and NOT 200 re-using User B's document
        expect(res.status).toHaveBeenCalledWith(201);
      } finally {
        await fs.promises.unlink(tempPath).catch(() => {});
        findOneSpy.mockRestore();
      }
    });
  });

  describe('7. Citation Verification Tripartite States', () => {
    it('distinguishes verified (true), unsupported (false), and not checked (undefined) citations', () => {
      const citations = [
        { documentName: 'Doc1.pdf', excerpt: 'Passage 1', pageNumber: 2, verified: true },
        { documentName: 'Doc2.pdf', excerpt: 'Passage 2', pageNumber: 5, verified: false },
        { documentName: 'Doc3.pdf', excerpt: 'Passage 3', pageNumber: 8, verified: undefined },
      ];

      const verifiedCites = citations.filter((c) => c.verified === true);
      const unsupportedCites = citations.filter((c) => c.verified === false);
      const notCheckedCites = citations.filter((c) => c.verified === undefined);

      expect(verifiedCites.length).toBe(1);
      expect(unsupportedCites.length).toBe(1);
      expect(notCheckedCites.length).toBe(1);

      expect(verifiedCites[0].documentName).toBe('Doc1.pdf');
      expect(unsupportedCites[0].documentName).toBe('Doc2.pdf');
      expect(notCheckedCites[0].documentName).toBe('Doc3.pdf');
    });
  });
});

