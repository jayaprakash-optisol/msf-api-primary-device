import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Worker, Job } from 'bullmq';
import { CarrierWorker } from '../../src/jobs/worker';
import * as metricsModule from '../../src/jobs/metrics';
import env from '../../src/config/env.config';

// Mock BullMQ Worker
let processJobFunction: (job: Job) => Promise<void>;

const mockWorkerInstance = {
  on: vi.fn((event, callback) => {
    // Store the callback functions for later manual triggering
    if (event === 'completed') completedCallback = callback;
    if (event === 'failed') failedCallback = callback;
    if (event === 'error') errorCallback = callback;
    return mockWorkerInstance;
  }),
  close: vi.fn().mockResolvedValue(undefined),
};

let completedCallback: (job: any) => void;
let failedCallback: (job: any, error: Error) => void;
let errorCallback: (error: Error) => void;

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn((queueName, processFn, options) => {
      // Store the process function for testing
      processJobFunction = processFn;
      return mockWorkerInstance;
    }),
    Job: vi.fn(),
  };
});

// Mock metrics
vi.mock('../../src/jobs/metrics', () => ({
  jobExecutionCounter: {
    inc: vi.fn(),
  },
  failedJobsCounter: {
    inc: vi.fn(),
  },
  retryAttemptsGauge: {
    set: vi.fn(),
  },
  lastSyncTimestampGauge: {
    set: vi.fn(),
  },
}));

// Mock env
vi.mock('../../src/config/env.config', () => ({
  default: {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
  },
}));

describe('CarrierWorker', () => {
  let worker: CarrierWorker;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create carrier worker
    worker = new CarrierWorker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize worker with correct configuration', () => {
    expect(Worker).toHaveBeenCalledWith('sync-queue', expect.any(Function), {
      connection: {
        host: env.REDIS_HOST,
        port: Number(env.REDIS_PORT),
      },
      concurrency: 2,
    });
  });

  it('should handle job completed event', () => {
    const mockJob = {
      id: 'job-123',
      log: vi.fn(),
    };

    // Mock Date.now() for consistent testing
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    // Verify that the event handler was registered
    expect(mockWorkerInstance.on).toHaveBeenCalledWith('completed', expect.any(Function));

    // Manually trigger the completed callback
    completedCallback(mockJob);

    // Check if the log was called
    expect(mockJob.log).toHaveBeenCalledWith('✅ Job job-123 completed successfully');

    // Check if metrics were updated
    expect(metricsModule.jobExecutionCounter.inc).toHaveBeenCalledWith({ status: 'success' });
    expect(metricsModule.lastSyncTimestampGauge.set).toHaveBeenCalledWith(1234567890);

    dateSpy.mockRestore();
  });

  it('should handle job failed event', () => {
    const mockJob = {
      id: 'job-123',
      log: vi.fn(),
      attemptsMade: 2,
    };

    const mockError = new Error('Test error');
    mockError.name = 'TestError';

    // Verify that the event handler was registered
    expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function));

    // Manually trigger the failed callback
    failedCallback(mockJob, mockError);

    // Check if the log was called
    expect(mockJob.log).toHaveBeenCalledWith(
      expect.stringContaining('❌ Job job-123 failed: Test error'),
    );

    // Check if metrics were updated
    expect(metricsModule.jobExecutionCounter.inc).toHaveBeenCalledWith({ status: 'error' });
    expect(metricsModule.failedJobsCounter.inc).toHaveBeenCalledWith({
      queue: 'carrier-sync',
      reason: 'TestError',
    });
    expect(metricsModule.retryAttemptsGauge.set).toHaveBeenCalledWith(
      { queue: 'carrier-sync', jobName: 'sync-carriers' },
      2,
    );
  });

  it('should handle job failed event with null job', () => {
    const mockError = new Error('Test error with null job');
    mockError.name = 'NullJobError';

    // Verify that the event handler was registered
    expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function));

    // Manually trigger the failed callback with null job
    failedCallback(null, mockError);

    // Only check that the error was logged and counter was incremented
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('❌ Job undefined failed: Test error with null job'),
    );

    // Job-specific metrics should not be called
    expect(metricsModule.failedJobsCounter.inc).not.toHaveBeenCalled();
    expect(metricsModule.retryAttemptsGauge.set).not.toHaveBeenCalled();

    // But the error counter should still be incremented
    expect(metricsModule.jobExecutionCounter.inc).toHaveBeenCalledWith({ status: 'error' });
  });

  it('should handle worker error event', () => {
    const mockError = new Error('Worker test error');

    // Mock Date.toLocaleString for consistent testing
    const dateToLocaleStringSpy = vi
      .spyOn(Date.prototype, 'toLocaleString')
      .mockReturnValue('2023-01-01 12:00:00');

    // Verify that the event handler was registered
    expect(mockWorkerInstance.on).toHaveBeenCalledWith('error', expect.any(Function));

    // Manually trigger the error callback
    errorCallback(mockError);

    // Check if the error was logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ Worker error: Error: Worker test error'),
    );

    // Check that createSystemLog was called properly (should see this in console.error)
    expect(console.error).toHaveBeenCalledWith(
      '[SYSTEM 2023-01-01 12:00:00] ⚠️ Worker error: Error: Worker test error',
    );

    dateToLocaleStringSpy.mockRestore();
  });

  it('should close worker correctly', async () => {
    await worker.close();
    expect(mockWorkerInstance.close).toHaveBeenCalled();
  });

  it('should process job correctly', async () => {
    // Ensure we have a process function
    expect(processJobFunction).toBeDefined();

    // Create a mock job
    const mockJob = {
      id: 'job-123',
      data: { timestamp: '1234567890' },
      log: vi.fn(),
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };

    // Process the job
    await processJobFunction(mockJob as unknown as Job);

    // Check if progress was updated
    expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);

    // Check if the job was logged
    expect(mockJob.log).toHaveBeenCalledWith(expect.stringContaining('⏱️'));
    expect(mockJob.log).toHaveBeenCalledWith(expect.stringContaining('Job data:'));
  });

  it('should handle errors in job processing', async () => {
    // Ensure we have a process function
    expect(processJobFunction).toBeDefined();

    // Create a mock job
    const mockJob = {
      id: 'job-123',
      data: { timestamp: '1234567890' },
      log: vi.fn(),
      updateProgress: vi.fn().mockRejectedValue(new Error('Progress update failed')),
    };

    // Expect the job processor to throw an error
    await expect(processJobFunction(mockJob as unknown as Job)).rejects.toThrow(
      'Progress update failed',
    );

    // Check if the error was logged
    expect(mockJob.log).toHaveBeenCalledWith(expect.stringContaining('❌'));
  });

  it('should log system messages via createSystemLog method', () => {
    // Create a new instance to access the private method createSystemLog
    const testWorker = new CarrierWorker();

    // Mock Date.toLocaleString for consistent testing
    const dateToLocaleStringSpy = vi
      .spyOn(Date.prototype, 'toLocaleString')
      .mockReturnValue('2023-01-01 12:00:00');

    // Need to access the private method using a workaround
    // @ts-ignore - accessing private method for testing
    testWorker['createSystemLog']('Test log message', false);
    // @ts-ignore - accessing private method for testing
    testWorker['createSystemLog']('Test error message', true);

    // Check that logs were created properly
    expect(console.log).toHaveBeenCalledWith('[SYSTEM 2023-01-01 12:00:00] Test log message');
    expect(console.error).toHaveBeenCalledWith('[SYSTEM 2023-01-01 12:00:00] Test error message');

    dateToLocaleStringSpy.mockRestore();
  });

  it('should handle job failed event with error without a name', () => {
    const mockJob = {
      id: 'job-123',
      log: vi.fn(),
      attemptsMade: 1,
    };

    // Create an error without a name property
    const mockError = new Error('Error without name');
    // Explicitly set name to undefined to test the fallback
    mockError.name = undefined as any;

    // Manually trigger the failed callback
    failedCallback(mockJob, mockError);

    // Check that the error with unknown reason was logged
    expect(metricsModule.failedJobsCounter.inc).toHaveBeenCalledWith({
      queue: 'carrier-sync',
      reason: 'unknown',
    });
  });

  it('should handle job failed event with a job without attemptsMade', () => {
    const mockJob = {
      id: 'job-123',
      log: vi.fn(),
      // No attemptsMade property
    };

    const mockError = new Error('Error with job without attempts');
    mockError.name = 'NoAttemptsError';

    // Manually trigger the failed callback
    failedCallback(mockJob, mockError);

    // Check that metrics were updated correctly
    expect(metricsModule.jobExecutionCounter.inc).toHaveBeenCalledWith({ status: 'error' });
    expect(metricsModule.failedJobsCounter.inc).toHaveBeenCalledWith({
      queue: 'carrier-sync',
      reason: 'NoAttemptsError',
    });

    // Make sure retryAttemptsGauge.set was not called since attemptsMade is not > 0
    expect(metricsModule.retryAttemptsGauge.set).not.toHaveBeenCalled();
  });
});
