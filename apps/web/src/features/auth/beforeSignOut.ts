// Work that must finish before sign-out, while the person's session still
// works (e.g. saving a Cycle Care change made a moment ago). Features add a
// task once; logout runs them all, briefly, and never fails because of one.

type Task = () => Promise<void>;
const tasks = new Set<Task>();

export function runBeforeSignOut(task: Task): void {
  tasks.add(task);
}

// Runs every task, waiting at most `timeoutMs` in all.
export async function beforeSignOut(timeoutMs = 2000): Promise<void> {
  const all = Promise.all([...tasks].map((t) => t().catch(() => undefined)));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
}
