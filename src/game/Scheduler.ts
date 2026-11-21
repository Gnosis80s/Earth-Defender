/**
 * Game-time scheduler: a replacement for `setTimeout` inside gameplay code.
 *
 * Delays are measured in *simulation* seconds, so scheduled events
 * automatically freeze while the game is paused, during hit-stop, or while
 * the tab is hidden — and `clear()` on reset guarantees no stale callback
 * from a previous run can fire into a new one.
 */
interface ScheduledTask {
  at: number;
  fn: () => void;
}

export class Scheduler {
  private tasks: ScheduledTask[] = [];
  private now = 0;

  /** Run `fn` after `delay` seconds of game time. */
  after(delay: number, fn: () => void) {
    this.tasks.push({ at: this.now + delay, fn });
  }

  /** Advance game time and fire every task that has come due, in order. */
  update(dt: number) {
    this.now += dt;
    // Tasks may schedule more tasks; loop until nothing due remains.
    for (;;) {
      let idx = -1;
      for (let i = 0; i < this.tasks.length; i++) {
        if (this.tasks[i].at <= this.now && (idx < 0 || this.tasks[i].at < this.tasks[idx].at)) {
          idx = i;
        }
      }
      if (idx < 0) return;
      const [task] = this.tasks.splice(idx, 1);
      task.fn();
    }
  }

  /** Drop all pending tasks (used on reset / quit). */
  clear() {
    this.tasks.length = 0;
    this.now = 0;
  }
}
