---
name: simple-tasks-usage
description: Build, refactor, and troubleshoot task queues using @rhymiz/simple-tasks (BullMQ v5 wrapper). Use when requests mention defineTask, runAllWorkers, enqueueing jobs, scheduled jobs, task workers, queue prefixes, Redis environment configuration, or migration from raw BullMQ workers/queues.
---

# Simple Tasks Usage

Implement function-based background tasks with `@rhymiz/simple-tasks`.
Follow this workflow unless the user asks for a different project structure.

## Quick Start Workflow

1. Install runtime dependencies:
```bash
bun add @rhymiz/simple-tasks bullmq
```
2. Create one module per queue domain in `src/queues/`.
3. Define tasks with `defineTask(...)` and export each task object.
4. Create a worker entrypoint that imports all queue modules, then call `runAllWorkers(...)`.
5. Enqueue work from application code with `task.enqueue(payload, jobOptions?)`.
6. Schedule recurring work with `task.schedule(id, repeatOptions, payload, jobOptions?)`.

## Define Tasks

Use this structure for every task definition:

```ts
import { defineTask } from "@rhymiz/simple-tasks";

type Payload = { userId: string };

export const sendWelcomeEmail = defineTask<Payload>({
  name: "send-welcome-email",
  queuePrefix: "emails",
  worker: { concurrency: 5 },
  defaultJobOptions: { attempts: 3 },
}, async (data, job) => {
  console.log("send", data.userId, job.id);
});
```

Use `queuePrefix` to group related jobs into one queue.
Set `worker` options at task definition time.
Set `defaultJobOptions` for retries/backoff defaults.

## Create Worker Entrypoint

Import queue modules before calling `runAllWorkers` so tasks register in the global registry:

```ts
import "./queues/email";
import "./queues/billing";

import { runAllWorkers } from "@rhymiz/simple-tasks/runtime";

const onlyQueues = process.env.QUEUES?.split(",").filter(Boolean);
const onlyJobs = process.env.JOBS?.split(",").filter(Boolean);

await runAllWorkers({ onlyQueues, onlyJobs });
```

Use `onlyQueues` for queue names and `onlyJobs` for task/job names.
Pass exact queue names after prefix resolution (for example `emails-send-welcome-email`).

## Enqueue Jobs

Enqueue from API handlers, services, or cron code:

```ts
await sendWelcomeEmail.enqueue({ userId: "123" });
await sendWelcomeEmail.enqueue(
  { userId: "123" },
  { delay: 10_000, attempts: 5 }
);
```

Use the second argument to override job options per enqueue.
Merge behavior is `defaultJobOptions` first, then per-call `jobOptions`.

## Schedule Recurring Jobs

Use BullMQ v5 job schedulers through the task object:

```ts
await sendWelcomeEmail.schedule(
  "daily-welcome-check",
  { pattern: "0 9 * * *" },
  { userId: "123" },
  { attempts: 3 }
);

const schedule = await sendWelcomeEmail.getSchedule("daily-welcome-check");
await sendWelcomeEmail.unschedule("daily-welcome-check");
```

Use stable scheduler ids so re-running setup code updates the same scheduler.
Use `{ every: milliseconds }` for interval schedules and `{ pattern: "cron" }`
for cron schedules.

Do not use BullMQ legacy repeatable-job APIs for new recurring work. This
package targets BullMQ 5 schedulers and does not migrate legacy repeatable jobs.

Scheduler template options intentionally omit `jobId`, `repeat`, `delay`,
`deduplication`, and `debounce`. Use scheduler ids for recurrence identity.

## Environment and Queue Naming

Use these environment variables for Redis and queue prefixing:

- `REDIS_URL` (takes precedence when set)
- `REDIS_HOST` (default `127.0.0.1`)
- `REDIS_PORT` (default `6379`)
- `SIMPLE_TASKS_QUEUE_PREFIX` (prepended to every queue as `<prefix>-`)

If a task sets `queuePrefix`, that value overrides `SIMPLE_TASKS_QUEUE_PREFIX` for that task.

## Constraints and Pitfalls

Apply these rules while coding:

1. Avoid `:` in `name` and `queuePrefix` (the package throws on invalid values).
2. Keep `worker` options consistent for tasks sharing one queue; the first task's worker options win.
3. Import each task module once in worker bootstrap; duplicate registration throws `Task already registered`.
4. Use `@rhymiz/simple-tasks/runtime` for `runAllWorkers`.
5. Keep task payload types explicit and serializable for BullMQ jobs.
6. Use `bun run test:e2e:scheduler` when local Redis is available and scheduler behavior needs end-to-end verification.
