import { Queue } from 'bullmq';
import env from '../config/env.config';

// Define job data interface
export interface SyncJobData {
  timestamp: string;
}

// Create the queue
export const syncQueue = new Queue<SyncJobData>('sync-queue', {
  connection: {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds
    },
    removeOnComplete: 100, // Keep the last 100 completed jobs
    removeOnFail: 100, // Keep the last 100 failed jobs
  },
});

// Function to add the job to the queue
export async function scheduleSyncJob(): Promise<void> {
  const jobData: SyncJobData = {
    timestamp: Date.now().toString(),
  };

  // Calculate when the next job should run (6 hours from now)
  const delay = env.SYNC_INTERVAL_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
  await syncQueue.add('sync-data', jobData, {
    repeat: {
      every: delay,
    },
  });

  console.log(`Scheduled carrier sync job to repeat ${env.SYNC_INTERVAL_HOURS}`);
}
