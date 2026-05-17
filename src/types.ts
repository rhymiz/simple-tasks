import type {
  Job,
  JobSchedulerJson,
  JobSchedulerTemplateOptions,
  JobsOptions,
  QueueOptions,
  RepeatOptions,
  WorkerOptions
} from "bullmq";

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

export type ScheduleRepeatOptions = Omit<RepeatOptions, "key">;
export type ScheduleJobOptions = JobSchedulerTemplateOptions;

export interface ScheduleFn<Data> {
  (
    id: string,
    repeatOptions: ScheduleRepeatOptions,
    data: Data,
    jobOptions?: ScheduleJobOptions
  ): Promise<void>;
}

export interface UnscheduleFn {
  (id: string): Promise<boolean>;
}

export interface GetScheduleFn<Data> {
  (id: string): Promise<JobSchedulerJson<Data> | undefined>;
}

export interface Task<Data, Result> {
  queueName: string;
  jobName: string;
  handler: TaskHandler<Data, Result>;
  enqueue: EnqueueFn<Data>;
  schedule: ScheduleFn<Data>;
  unschedule: UnscheduleFn;
  getSchedule: GetScheduleFn<Data>;
}
