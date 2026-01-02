import type { JobsOptions } from "bullmq";
import { taskRegistry } from "./registry";
import { getQueue } from "./queues";
import { defaultQueuePrefix } from "./config";
import type {
  DefineTaskOptions,
  Task,
  TaskDefinition,
  TaskHandler
} from "./types";

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

  return {
    queueName: queue,
    jobName: name,
    handler,
    enqueue
  };
}
