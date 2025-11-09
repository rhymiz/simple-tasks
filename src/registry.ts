import type { TaskDefinition } from "./types";

class TaskRegistry {
  private readonly tasks = new Map<string, TaskDefinition<unknown, unknown>>();

  private makeKey(queueName: string, jobName: string): string {
    return `${queueName}:${jobName}`;
  }

  register<Data, Result>(definition: TaskDefinition<Data, Result>): void {
    const registryKey = this.makeKey(definition.queueName, definition.jobName);
    if (this.tasks.has(registryKey)) {
      throw new Error(`Task already registered: ${registryKey}`);
    }
    this.tasks.set(
      registryKey,
      definition as unknown as TaskDefinition<unknown, unknown>
    );
  }

  getAll(): TaskDefinition<unknown, unknown>[] {
    return [...this.tasks.values()];
  }
}

export const taskRegistry = new TaskRegistry();


