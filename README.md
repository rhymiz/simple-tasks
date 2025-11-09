# simple-tasks

Function-based task framework on top of BullMQ. Define tasks with a single function, enqueue them easily, and run all workers from one entrypoint.

## Install

```bash
bun install simple-tasks bullmq
```

Peer dependencies:
- bullmq (>=4 <6)

## Quick start

Define a task:

```ts
// src/queues/email.ts
import { defineTask } from 'simple-tasks';

type SendWelcomeData = { userId: string };

export const sendWelcomeEmail = defineTask<SendWelcomeData>({
  queue: 'emails',
  name: 'send-welcome-email',
  worker: { concurrency: 5 },
  defaultJobOptions: { attempts: 3 },
}, async (data, job) => {
  console.log('Sending welcome email to', data.userId, 'job', job.id);
});
```

Enqueue from anywhere:

```ts
await sendWelcomeEmail.enqueue({ userId: '123' });
await sendWelcomeEmail.enqueue({ userId: '123' }, { delay: 10_000 });
```

Worker entrypoint:

```ts
// src/queue-worker.ts
import './queues/email';
import './queues/billing';
import './queues/notifications';

import { runAllWorkers } from 'simple-tasks/runtime';

const onlyQueues = process.env.QUEUES?.split(',').filter(Boolean);
const onlyJobs = process.env.JOBS?.split(',').filter(Boolean);

runAllWorkers({ onlyQueues, onlyJobs });
```

## Configuration

The framework passes connection options to BullMQ (host/port). Configure via environment variables:
- `REDIS_HOST` (default: `127.0.0.1`)
- `REDIS_PORT` (default: `6379`)

BullMQ manages its own clients; this package does not import `ioredis` directly.

## Scripts

This package is built with Bun.

```bash
bun run build           # build JS and .d.ts into dist/
npm publish             # publish to npm (build runs via prepare)
```

## License

MIT
