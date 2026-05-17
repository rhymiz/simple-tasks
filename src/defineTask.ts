import type {
  JobSchedulerJson,
  JobSchedulerTemplateOptions,
  JobsOptions
} from "bullmq";
import { taskRegistry } from "./registry";
import { getQueue } from "./queues";
import { defaultQueuePrefix } from "./config";
import type {
  DefineTaskOptions,
  ScheduleRepeatOptions,
  Task,
  TaskDefinition,
  TaskHandler
} from "./types";

function toSchedulerTemplateOptions(
  options?: JobsOptions
): JobSchedulerTemplateOptions {
  const {
    jobId: _jobId,
    repeat: _repeat,
    delay: _delay,
    deduplication: _deduplication,
    debounce: _debounce,
    ...templateOptions
  } = options ?? {};

  return templateOptions;
}

export function defineTask<Data = unknown, Result = unknown>(
  options: DefineTaskOptions,
  handler: TaskHandler<Data, Result>
): Task<Data, Result> {
  const {
    name,
    queuePrefix,
    defaultJobOptions,
    queueOptions,
    worker: workerOptions
  } = options;

  const resolvedPrefix = queuePrefix ?? defaultQueuePrefix();
  if (name.includes(":")) {
    throw new Error('Task name cannot contain ":"');
  }
  if (resolvedPrefix?.includes(":")) {
    throw new Error('Queue prefix cannot contain ":"');
  }

  const delimiter = "-";
  const prefix = resolvedPrefix
    ? resolvedPrefix.endsWith(delimiter)
      ? resolvedPrefix
      : `${resolvedPrefix}${delimiter}`
    : "";
  const queue = `${prefix}${name}`;

  const definition: TaskDefinition<Data, Result> = {
    queueName: queue,
    jobName: name,
    handler,
    queueOptions,
    workerOptions,
    defaultJobOptions
  };

  taskRegistry.register(definition);

  // Use an untyped queue instance to remain compatible with BullMQ's
  // typed job map inference while keeping our public API strongly typed.
  const queueInstance = getQueue<unknown>(queue, queueOptions);

  const enqueue = async (data: Data, jobOptions?: JobsOptions) => {
    await queueInstance.add(name, data as unknown, {
      ...(defaultJobOptions ?? {}),
      ...(jobOptions ?? {})
    });
  };

  const schedule = async (
    id: string,
    repeatOptions: ScheduleRepeatOptions,
    data: Data,
    jobOptions?: JobSchedulerTemplateOptions
  ) => {
    await queueInstance.upsertJobScheduler(id, repeatOptions, {
      name,
      data: data as unknown,
      opts: {
        ...toSchedulerTemplateOptions(defaultJobOptions),
        ...toSchedulerTemplateOptions(jobOptions)
      }
    });
  };

  const unschedule = async (id: string) =>
    queueInstance.removeJobScheduler(id);

  const getSchedule = async (id: string) =>
    queueInstance.getJobScheduler(id) as Promise<
      JobSchedulerJson<Data> | undefined
    >;

  return {
    queueName: queue,
    jobName: name,
    handler,
    enqueue,
    schedule,
    unschedule,
    getSchedule
  };
}
