import { Worker } from "bullmq";
import { taskRegistry } from "./registry";
import { baseWorkerOptions } from "./config";

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

  for (const def of tasks) {
    if (!shouldRunQueue(def.queueName)) continue;
    if (!shouldRunJob(def.jobName)) continue;

    const worker = new Worker<unknown, unknown, string>(
      def.queueName,
      async job => {
        return def.handler(job.data, job);
      },
      {
        ...baseWorkerOptions(),
        ...(def.workerOptions ?? {}),
        // Bind this worker to the specific job name to avoid processing other tasks on the same queue.
        name: def.jobName
      }
    );

    worker.on("completed", job => {
      console.log(`[${def.queueName}] completed ${def.jobName} (id=${job.id})`);
    });

    worker.on("failed", (job, err) => {
      console.error(
        `[${def.queueName}] FAILED ${def.jobName} (id=${job?.id})`,
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

