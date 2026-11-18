import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { StorageService } from '../services/storage/supabaseStorage.js';
import { config } from '../config/env.js';

// Mock Supabase client
const mockListBuckets = vi.fn();
const mockCreateBucket = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    storage: {
      listBuckets: mockListBuckets,
      createBucket: mockCreateBucket,
    },
  })),
}));

describe('StorageService In-Memory Bucket Cache', () => {
  const originalUrl = config.supabaseUrl;
  const originalKey = config.supabaseServiceKey;

  beforeEach(() => {
    vi.clearAllMocks();
    config.supabaseUrl = 'https://fake-test-project.supabase.co';
    config.supabaseServiceKey = 'fake-service-role-key-12345';
    config.supabaseBucket = 'documents';
    StorageService.resetBucketCache();
  });

  afterAll(() => {
    config.supabaseUrl = originalUrl;
    config.supabaseServiceKey = originalKey;
    StorageService.resetBucketCache();
  });

  it('checks bucket on initial call and caches successful verification', async () => {
    mockListBuckets.mockResolvedValueOnce({
      data: [{ name: 'documents' }],
      error: null,
    });

    // First call: should query Supabase storage
    const firstResult = await StorageService.ensureBucket();
    expect(firstResult).toBe(true);
    expect(mockListBuckets).toHaveBeenCalledTimes(1);

    // Second call: should hit in-memory cache and not call listBuckets again
    const secondResult = await StorageService.ensureBucket();
    expect(secondResult).toBe(true);
    expect(mockListBuckets).toHaveBeenCalledTimes(1);

    // Third call: still cached
    const thirdResult = await StorageService.ensureBucket();
    expect(thirdResult).toBe(true);
    expect(mockListBuckets).toHaveBeenCalledTimes(1);
  });

  it('creates bucket if absent and caches successful creation', async () => {
    mockListBuckets.mockResolvedValueOnce({
      data: [{ name: 'other-bucket' }],
      error: null,
    });
    mockCreateBucket.mockResolvedValueOnce({
      data: { name: 'documents' },
      error: null,
    });

    const result1 = await StorageService.ensureBucket();
    expect(result1).toBe(true);
    expect(mockListBuckets).toHaveBeenCalledTimes(1);
    expect(mockCreateBucket).toHaveBeenCalledTimes(1);

    // Subsequent call should be served from memory
    const result2 = await StorageService.ensureBucket();
    expect(result2).toBe(true);
    expect(mockListBuckets).toHaveBeenCalledTimes(1);
    expect(mockCreateBucket).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache failed bucket checks', async () => {
    mockListBuckets.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network connection timeout' },
    });

    // First call fails
    const failResult = await StorageService.ensureBucket();
    expect(failResult).toBe(false);
    expect(mockListBuckets).toHaveBeenCalledTimes(1);

    // Second call should retry and NOT be cached as failure
    mockListBuckets.mockResolvedValueOnce({
      data: [{ name: 'documents' }],
      error: null,
    });

    const retryResult = await StorageService.ensureBucket();
    expect(retryResult).toBe(true);
    expect(mockListBuckets).toHaveBeenCalledTimes(2);
  });

  it('resets cache when resetBucketCache is explicitly called', async () => {
    mockListBuckets.mockResolvedValue({
      data: [{ name: 'documents' }],
      error: null,
    });

    await StorageService.ensureBucket();
    expect(mockListBuckets).toHaveBeenCalledTimes(1);

    StorageService.resetBucketCache();

    await StorageService.ensureBucket();
    expect(mockListBuckets).toHaveBeenCalledTimes(2);
  });
});
