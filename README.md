# simple-tasks

Function-based task framework on top of BullMQ. Define tasks with a single function, enqueue them easily, and run all workers from one entrypoint.

![NPM Version](https://img.shields.io/npm/v/@rhymiz/simple-tasks)


## Install

```bash
bun install @rhymiz/simple-tasks bullmq
```

Peer dependencies:
- bullmq (>=4 <6)

## Quick start

Define a task:

```ts
// src/queues/email.ts
import { defineTask } from '@rhymiz/simple-tasks';

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

import { runAllWorkers } from '@rhymiz/simple-tasks/runtime';

const onlyQueues = process.env.QUEUES?.split(',').filter(Boolean);
const onlyJobs = process.env.JOBS?.split(',').filter(Boolean);

runAllWorkers({ onlyQueues, onlyJobs });
```

## Configuration

The framework passes connection options to BullMQ (host/port). Configure via environment variables:
- `REDIS_HOST` (default: `127.0.0.1`)
- `REDIS_PORT` (default: `6379`)

BullMQ manages its own clients; this package does not import `ioredis` directly.

## Development

This package is built with Bun.

```bash
bun run build           # build JS and .d.ts into dist/
bun run lint            # run linter
bun run pack            # create tarball for testing
```

## Releasing

This project uses automated releases via GitHub Actions.

### Manual Release Process

1. **Bump version** (creates a git tag automatically):
   ```bash
   bun run version:patch   # 0.1.0 -> 0.1.1 (bug fixes)
   bun run version:minor   # 0.1.0 -> 0.2.0 (new features)
   bun run version:major   # 0.1.0 -> 1.0.0 (breaking changes)
   ```

2. **Push the tag** to trigger the release:
   ```bash
   git push --follow-tags
   ```

3. The GitHub Action will automatically:
   - Create a GitHub Release
   - Build the package
   - Publish to GitHub Package Registry

### Using the Package

To install from GitHub Packages, add to your `.npmrc`:
```
@rhymiz:registry=https://npm.pkg.github.com
```

Then install:
```bash
bun install @rhymiz/simple-tasks bullmq
```

## License

MIT
