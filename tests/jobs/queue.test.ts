import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import env from '../../src/config/env.config';

// Mock env config must be defined before importing
vi.mock('../../src/config/env.config', () => ({
  default: {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    SYNC_INTERVAL_HOURS: 6,
  },
}));

// Mock BullMQ Queue
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue(undefined),
      getWaitingCount: vi.fn().mockResolvedValue(0),
      getActiveCount: vi.fn().mockResolvedValue(0),
      getCompletedCount: vi.fn().mockResolvedValue(0),
      getFailedCount: vi.fn().mockResolvedValue(0),
      getDelayedCount: vi.fn().mockResolvedValue(0),
    })),
  };
});

// Import must be after the mocks
import * as queueModule from '../../src/jobs/queue';

describe('Queue Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should schedule a sync job with correct parameters', async () => {
    // Get the mock instance from the instantiated queue
    const mockQueueAdd = vi.spyOn(queueModule.syncQueue, 'add');

    // Mock Date.now() for consistent testing
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    await queueModule.scheduleSyncJob();

    // Verify job data was added to the queue correctly
    const expectedJobData = {
      timestamp: '1234567890',
    };

    const delay = env.SYNC_INTERVAL_HOURS * 60 * 60 * 1000;

    expect(mockQueueAdd).toHaveBeenCalledWith('sync-data', expectedJobData, {
      repeat: {
        every: delay,
      },
    });

    expect(console.log).toHaveBeenCalledWith(
      `Scheduled carrier sync job to repeat ${env.SYNC_INTERVAL_HOURS}`,
    );

    dateSpy.mockRestore();
  });
});
