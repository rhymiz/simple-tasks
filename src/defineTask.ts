import type { JobsOptions } from "bullmq";
import { taskRegistry } from "./registry";
import { getQueue } from "./queues";
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
    queue,
    name,
    defaultJobOptions,
    queueOptions,
    worker: workerOptions
  } = options;

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


