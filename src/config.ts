import type { QueueOptions, WorkerOptions } from "bullmq";

type BullConnectionOptions = QueueOptions["connection"];

function getConnectionOptions(): BullConnectionOptions {
  const host = process.env.REDIS_HOST ?? "127.0.0.1";
  const portRaw = process.env.REDIS_PORT ?? "6379";
  const port = Number(portRaw);

  // We provide plain connection options and let BullMQ manage its own clients.
  // Avoid importing ioredis directly to remain runtime-agnostic and Bun-friendly.
  const connection = {
    host,
    port: Number.isFinite(port) ? port : 6379,
    // Commonly recommended for BullMQ to prevent request retry confusion
    // when using blocking commands behind the scenes.
    maxRetriesPerRequest: null
  } as unknown as BullConnectionOptions;

  return connection;
}

export function baseQueueOptions(): QueueOptions {
  return { connection: getConnectionOptions() };
}

export function baseWorkerOptions(): WorkerOptions {
  return { connection: getConnectionOptions() };
}


