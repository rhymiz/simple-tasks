import type { Job, JobsOptions, QueueOptions, WorkerOptions } from "bullmq";

export type TaskHandler<Data, Result = unknown> = (
  data: Data,
  job: Job<Data>
) => Promise<Result> | Result;

export interface DefineTaskOptions {
  name: string;
  queuePrefix?: string;
  defaultJobOptions?: JobsOptions;
  queueOptions?: QueueOptions;
  worker?: WorkerOptions;
}

export interface TaskDefinition<Data = unknown, Result = unknown> {
  queueName: string;
  jobName: string;
  handler: TaskHandler<Data, Result>;
  queueOptions?: QueueOptions;
  workerOptions?: WorkerOptions;
  defaultJobOptions?: JobsOptions;
}

export interface EnqueueFn<Data> {
  (data: Data, jobOptions?: JobsOptions): Promise<void>;
}

export interface Task<Data, Result> {
  queueName: string;
  jobName: string;
  handler: TaskHandler<Data, Result>;
  enqueue: EnqueueFn<Data>;
}
