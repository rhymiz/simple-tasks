import { Queue } from "bullmq";
import type { QueueOptions } from "bullmq";
import { baseQueueOptions } from "./config";

const queueCache = new Map<string, Queue<unknown, unknown, string>>();

export function getQueue<Data = unknown>(
  name: string,
  options?: QueueOptions
): Queue<Data, unknown, string> {
  if (!queueCache.has(name)) {
    const q = new Queue<unknown, unknown, string>(name, {
      ...baseQueueOptions(),
      ...(options ?? {})
    });
    queueCache.set(name, q);
  }
  return queueCache.get(name)! as Queue<Data, unknown, string>;
}


