import { beforeEach, expect, mock, test } from "bun:test";
import type {
  JobSchedulerJson,
  JobSchedulerTemplateOptions,
  JobsOptions,
  RepeatOptions
} from "bullmq";

type ScheduleRepeatOptions = Omit<RepeatOptions, "key">;

interface AddCall {
  name: string;
  data: unknown;
  opts: JobsOptions;
}

interface SchedulerTemplate {
  name?: string;
  data?: unknown;
  opts?: JobSchedulerTemplateOptions;
}

interface UpsertJobSchedulerCall {
  id: string;
  repeatOptions: ScheduleRepeatOptions;
  template?: SchedulerTemplate;
}

class MockQueue {
  readonly name: string;
  readonly options: unknown;
  readonly addCalls: AddCall[] = [];
  readonly upsertJobSchedulerCalls: UpsertJobSchedulerCall[] = [];
  readonly removeJobSchedulerCalls: string[] = [];
  readonly getJobSchedulerCalls: string[] = [];
  readonly schedulerResults = new Map<string, JobSchedulerJson<unknown>>();

  constructor(name: string, options: unknown) {
    this.name = name;
    this.options = options;
    queueInstances.push(this);
  }

  async add(name: string, data: unknown, opts: JobsOptions) {
    this.addCalls.push({ name, data, opts });
  }

  async upsertJobScheduler(
    id: string,
    repeatOptions: ScheduleRepeatOptions,
    template?: SchedulerTemplate
  ) {
    this.upsertJobSchedulerCalls.push({ id, repeatOptions, template });
    return { id: `${id}:next` };
  }

  async removeJobScheduler(id: string) {
    this.removeJobSchedulerCalls.push(id);
    return true;
  }

  async getJobScheduler(id: string) {
    this.getJobSchedulerCalls.push(id);
    return this.schedulerResults.get(id);
  }
}

class MockWorker {
  constructor(
    readonly queueName: string,
    readonly processor: unknown,
    readonly options: unknown
  ) {}

  on() {
    return this;
  }
}

let queueInstances: MockQueue[] = [];
let taskSequence = 0;

mock.module("bullmq", () => ({
  Queue: MockQueue,
  Worker: MockWorker
}));

const { defineTask } = await import("../src/defineTask");

beforeEach(() => {
  queueInstances = [];
});

function nextTaskName(base: string) {
  taskSequence += 1;
  return `${base}-${taskSequence}`;
}

function latestQueue() {
  const queue = queueInstances.at(-1);
  expect(queue).toBeDefined();
  return queue!;
}

test("enqueue keeps BullMQ job options behavior unchanged", async () => {
  const task = defineTask<{ userId: string }>({
    name: nextTaskName("send-email"),
    queuePrefix: "emails",
    defaultJobOptions: {
      attempts: 3,
      delay: 1_000,
      jobId: "default-id"
    }
  }, () => {});

  await task.enqueue({ userId: "user-1" }, { attempts: 5 });

  const queue = latestQueue();
  expect(queue.addCalls).toEqual([
    {
      name: task.jobName,
      data: { userId: "user-1" },
      opts: {
        attempts: 5,
        delay: 1_000,
        jobId: "default-id"
      }
    }
  ]);
});

test("schedule upserts a BullMQ v5 job scheduler with filtered template options", async () => {
  const task = defineTask<{ orgId: string }>({
    name: nextTaskName("daily-report"),
    queuePrefix: "reports",
    defaultJobOptions: {
      attempts: 3,
      delay: 1_000,
      jobId: "default-id",
      repeat: { every: 60_000 },
      deduplication: { id: "default-deduplication" },
      debounce: { id: "default-debounce" },
      removeOnComplete: true
    }
  }, () => {});

  await task.schedule(
    "daily-report",
    { pattern: "0 9 * * *", immediately: true },
    { orgId: "org-1" },
    {
      attempts: 5,
      delay: 5_000,
      jobId: "override-id",
      deduplication: { id: "override-deduplication" },
      debounce: { id: "override-debounce" },
      priority: 1
    } as JobsOptions
  );

  const queue = latestQueue();
  expect(queue.upsertJobSchedulerCalls).toEqual([
    {
      id: "daily-report",
      repeatOptions: { pattern: "0 9 * * *", immediately: true },
      template: {
        name: task.jobName,
        data: { orgId: "org-1" },
        opts: {
          attempts: 5,
          removeOnComplete: true,
          priority: 1
        }
      }
    }
  ]);
});

test("unschedule removes a BullMQ v5 job scheduler by id", async () => {
  const task = defineTask({
    name: nextTaskName("cleanup"),
    queuePrefix: "maintenance"
  }, () => {});

  await expect(task.unschedule("nightly-cleanup")).resolves.toBe(true);

  const queue = latestQueue();
  expect(queue.removeJobSchedulerCalls).toEqual(["nightly-cleanup"]);
});

test("getSchedule reads a BullMQ v5 job scheduler by id", async () => {
  const task = defineTask<{ tenantId: string }>({
    name: nextTaskName("sync-tenant"),
    queuePrefix: "sync"
  }, () => {});
  const queue = latestQueue();
  queue.schedulerResults.set("hourly-sync", {
    key: "hourly-sync",
    name: task.jobName,
    every: 3_600_000,
    template: {
      data: { tenantId: "tenant-1" }
    }
  });

  await expect(task.getSchedule("hourly-sync")).resolves.toEqual({
    key: "hourly-sync",
    name: task.jobName,
    every: 3_600_000,
    template: {
      data: { tenantId: "tenant-1" }
    }
  });
  expect(queue.getJobSchedulerCalls).toEqual(["hourly-sync"]);
});
