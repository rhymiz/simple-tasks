import { defineTask } from "../src/index";
import { runAllWorkers } from "../src/runtime";
import { getQueue } from "../src/queues";

interface SmokePayload {
  runId: string;
}

const timeoutMs = Number(process.env.SCHEDULER_E2E_TIMEOUT_MS ?? "10000");
const runId = `scheduler-e2e-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;
const queuePrefix = runId;
const scheduleId = `${runId}-schedule`;

let executionCount = 0;
let resolveExecution: (jobId: string | undefined) => void = () => {};
let rejectExecution: (error: Error) => void = () => {};

const firstExecution = new Promise<string | undefined>((resolve, reject) => {
  resolveExecution = resolve;
  rejectExecution = reject;
});

const timeout = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(
      new Error(
        `Timed out after ${timeoutMs}ms waiting for scheduled job execution.`
      )
    );
  }, timeoutMs);
});

const smokeTask = defineTask<SmokePayload>({
  name: "scheduler-e2e",
  queuePrefix,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true
  }
}, async (data, job) => {
  executionCount += 1;

  if (data.runId !== runId) {
    const error = new Error(
      `Expected runId ${runId}, received ${data.runId}.`
    );
    rejectExecution(error);
    throw error;
  }

  console.log(
    `[scheduler-e2e] handled scheduled job id=${job.id} count=${executionCount}`
  );
  resolveExecution(job.id);
});

const queue = getQueue(smokeTask.queueName);
const workers = await runAllWorkers({
  onlyQueues: [smokeTask.queueName],
  onlyJobs: [smokeTask.jobName]
});

try {
  await Promise.all(workers.map(worker => worker.waitUntilReady()));

  await smokeTask.schedule(
    scheduleId,
    { every: 1_000 },
    { runId },
    {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true
    }
  );

  const schedule = await smokeTask.getSchedule(scheduleId);
  if (!schedule) {
    throw new Error(`Scheduler ${scheduleId} was not created.`);
  }

  console.log(
    `[scheduler-e2e] scheduled ${scheduleId} on queue ${smokeTask.queueName}`
  );

  const jobId = await Promise.race([firstExecution, timeout]);

  if (executionCount < 1) {
    throw new Error("Scheduled job did not execute.");
  }

  console.log(`[scheduler-e2e] success jobId=${jobId ?? "unknown"}`);
} finally {
  await smokeTask.unschedule(scheduleId).catch(error => {
    console.error(`[scheduler-e2e] failed to remove scheduler`, error);
  });

  await Promise.all(workers.map(worker => worker.close()));

  await queue.obliterate({ force: true }).catch(error => {
    console.error(`[scheduler-e2e] failed to obliterate queue`, error);
  });

  await queue.close();
}
