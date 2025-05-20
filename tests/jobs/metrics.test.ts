import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing the metrics module
vi.mock('prom-client', () => {
  return {
    Registry: vi.fn().mockImplementation(() => ({
      metrics: vi.fn().mockReturnValue('metrics data'),
      contentType: 'text/plain',
    })),
    Counter: vi.fn().mockImplementation(() => ({
      inc: vi.fn(),
      reset: vi.fn(),
    })),
    Gauge: vi.fn().mockImplementation(() => ({
      set: vi.fn(),
      reset: vi.fn(),
    })),
    collectDefaultMetrics: vi.fn(),
  };
});

vi.mock('../../src/jobs/queue', () => ({
  syncQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(1),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getCompletedCount: vi.fn().mockResolvedValue(3),
    getFailedCount: vi.fn().mockResolvedValue(4),
    getDelayedCount: vi.fn().mockResolvedValue(5),
  },
}));

// Now import the metrics module
import * as metrics from '../../src/jobs/metrics';
import { syncQueue } from '../../src/jobs/queue';

describe('Metrics Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export metrics objects', () => {
    // Verify exports exist
    expect(metrics.registry).toBeDefined();
    expect(metrics.jobExecutionCounter).toBeDefined();
    expect(metrics.jobDurationGauge).toBeDefined();
    expect(metrics.carriersFetchedGauge).toBeDefined();
    expect(metrics.queueSizeGauge).toBeDefined();
    expect(metrics.failedJobsCounter).toBeDefined();
    expect(metrics.retryAttemptsGauge).toBeDefined();
    expect(metrics.waitingDurationGauge).toBeDefined();
    expect(metrics.jobProcessingDurationGauge).toBeDefined();
    expect(metrics.lastSyncTimestampGauge).toBeDefined();
    expect(metrics.redisConnectionGauge).toBeDefined();
  });

  it('should reset all metrics when initMetrics is called', () => {
    // Create spy for reset method
    const resetSpy = vi.spyOn(metrics.jobExecutionCounter, 'reset');
    const resetSpyGauge = vi.spyOn(metrics.queueSizeGauge, 'reset');

    metrics.initMetrics();

    // Simply verify that reset was called
    expect(resetSpy).toHaveBeenCalled();
    expect(resetSpyGauge).toHaveBeenCalled();
  });

  it('should update queue metrics correctly', async () => {
    // Create spy for the gauge set methods
    const setQueueSizeSpy = vi.spyOn(metrics.queueSizeGauge, 'set');
    const setRedisConnSpy = vi.spyOn(metrics.redisConnectionGauge, 'set');

    await metrics.updateQueueMetrics();

    // Verify that all queue counts were fetched
    expect(syncQueue.getWaitingCount).toHaveBeenCalled();
    expect(syncQueue.getActiveCount).toHaveBeenCalled();
    expect(syncQueue.getCompletedCount).toHaveBeenCalled();
    expect(syncQueue.getFailedCount).toHaveBeenCalled();
    expect(syncQueue.getDelayedCount).toHaveBeenCalled();

    // Verify only that the set methods were called, not the exact arguments
    expect(setQueueSizeSpy).toHaveBeenCalledTimes(5); // Once for each queue state
    expect(setRedisConnSpy).toHaveBeenCalledWith(1); // Redis connected
  });

  it('should handle errors when updating queue metrics', async () => {
    // Create spy for the Redis connection gauge
    const setRedisConnSpy = vi.spyOn(metrics.redisConnectionGauge, 'set');

    // Mock syncQueue.getWaitingCount to throw an error
    (syncQueue.getWaitingCount as any).mockRejectedValueOnce(new Error('Redis connection error'));

    await metrics.updateQueueMetrics();

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Error updating queue metrics:', expect.any(Error));

    // Verify Redis connection status was set to disconnected
    expect(setRedisConnSpy).toHaveBeenCalledWith(0);
  });
});
