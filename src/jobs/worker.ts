import { Worker, Job } from 'bullmq';
import env from '../config/env.config';
import { SyncJobData } from './queue';
import {
  jobExecutionCounter,
  failedJobsCounter,
  retryAttemptsGauge,
  lastSyncTimestampGauge,
} from './metrics';

export class CarrierWorker {
  private readonly worker: Worker;

  constructor() {
    // Create worker to process jobs
    this.worker = new Worker<SyncJobData>('sync-queue', async job => this.processJob(job), {
      connection: {
        host: env.REDIS_HOST,
        port: Number(env.REDIS_PORT),
      },
      // For high concurrency, you can increase this number
      concurrency: 2,
    });

    // Setup event listeners
    this.setupEventListeners();
  }

  // Helper method to create system logs since worker.logger is not available
  private createSystemLog(message: string, isError: boolean = false): void {
    const now = new Date().toLocaleString();
    const logEntry = `[SYSTEM ${now}] ${message}`;

    if (isError) {
      console.error(logEntry);
    } else {
      console.log(logEntry);
    }
  }

  private setupEventListeners(): void {
    // Handle successful job completion
    this.worker.on('completed', job => {
      const message = `✅ Job ${job.id} completed successfully`;
      console.log(message);
      job.log(message);
      jobExecutionCounter.inc({ status: 'success' });

      // Update last sync timestamp
      lastSyncTimestampGauge.set(Date.now());
    });

    // Handle job failures
    this.worker.on('failed', (job, err) => {
      const message = `❌ Job ${job?.id} failed: ${err.message}`;
      console.error(message);
      if (job) {
        job.log(message);
        // Increment metrics for failed jobs
        failedJobsCounter.inc({ queue: 'carrier-sync', reason: err.name || 'unknown' });
        // Track retry attempts if available
        if (job.attemptsMade > 0) {
          retryAttemptsGauge.set(
            { queue: 'carrier-sync', jobName: 'sync-carriers' },
            job.attemptsMade,
          );
        }
      }
      jobExecutionCounter.inc({ status: 'error' });
    });

    // Handle worker errors
    this.worker.on('error', err => {
      const message = `⚠️ Worker error: ${err}`;
      console.error(message);
      this.createSystemLog(message, true);
    });
  }

  private async processJob(job: Job<SyncJobData>): Promise<void> {
    const now = new Date().toLocaleString();
    const startMessage = `⏱️ [${now}] Processing job ${job.id}`;
    console.log(startMessage, job.data);
    await job.log(startMessage);
    await job.log(`Job data: ${JSON.stringify(job.data)}`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Business logic goes here

      // Update job progress
      await job.updateProgress(50);

      // Update job progress
      await job.updateProgress(100);

      return;
    } catch (error) {
      const errorMessage = `❌ [${new Date().toLocaleString()}] Error processing carrier sync job: ${error}`;
      console.error(errorMessage);
      await job.log(errorMessage);
      throw error;
    }
  }

  // Close the worker when needed
  async close(): Promise<void> {
    await this.worker.close();
  }
}
