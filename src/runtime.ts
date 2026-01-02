import { Worker } from "bullmq";
import { taskRegistry } from "./registry";
import { baseWorkerOptions } from "./config";
import type { TaskDefinition } from "./types";

interface RunWorkersOptions {
  onlyQueues?: string[];
  onlyJobs?: string[];
}

export async function runAllWorkers(options: RunWorkersOptions = {}) {
  const { onlyQueues, onlyJobs } = options;

  const tasks = taskRegistry.getAll();
  const workers: Worker<unknown, unknown, string>[] = [];

  const shouldRunQueue = (queue: string) =>
    !onlyQueues || onlyQueues.includes(queue);

  const shouldRunJob = (name: string) =>
    !onlyJobs || onlyJobs.includes(name);

  const tasksByQueue = new Map<string, TaskDefinition<unknown, unknown>[]>();

  for (const def of tasks) {
    if (!shouldRunQueue(def.queueName)) continue;
    if (!shouldRunJob(def.jobName)) continue;
    const queueTasks = tasksByQueue.get(def.queueName) ?? [];
    queueTasks.push(def);
    tasksByQueue.set(def.queueName, queueTasks);
  }

  for (const [queueName, defs] of tasksByQueue) {
    const handlers = new Map<string, TaskDefinition<unknown, unknown>>();
    for (const def of defs) {
      handlers.set(def.jobName, def);
    }

    const [firstDef] = defs;
    const workerOptions = firstDef?.workerOptions;
    if (defs.length > 1) {
      const serialized = JSON.stringify(workerOptions ?? {});
      for (const def of defs.slice(1)) {
        if (JSON.stringify(def.workerOptions ?? {}) !== serialized) {
          console.warn(
            `[${queueName}] Multiple worker options detected; using the first definition's options.`
          );
          break;
        }
      }
    }

    const worker = new Worker<unknown, unknown, string>(
      queueName,
      async job => {
        const def = handlers.get(job.name);
        if (!def) {
          throw new Error(
            `No handler registered for job "${job.name}" on queue "${queueName}".`
          );
        }
        return def.handler(job.data, job);
      },
      {
        ...baseWorkerOptions(),
        ...(workerOptions ?? {})
      }
    );

    worker.on("completed", job => {
      console.log(`[${queueName}] completed ${job.name} (id=${job.id})`);
    });

    worker.on("failed", (job, err) => {
      const jobName = job?.name ?? "unknown";
      console.error(
        `[${queueName}] FAILED ${jobName} (id=${job?.id})`,
        err
      );
    });

    workers.push(worker);
  }

  console.log(
    `Started ${workers.length} workers for ${
      onlyQueues ? onlyQueues.join(",") : "all queues"
    }`
  );

  return workers;
}
