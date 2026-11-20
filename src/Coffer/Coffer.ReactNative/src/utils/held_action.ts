/**
 * The 5-second Undo of the review screen: an action is held, not sent, until the delay ends. Undo simply cancels it,
 * so nothing ever has to be reversed on the server. If the app dies meanwhile, the action was never sent and the cap
 * is still waiting: losing a decision costs a tap, never data.
 */
export interface HeldAction {
  id: string;
  label: string;
  send: () => Promise<void>;
}

interface HeldActionQueueOptions {
  delayMs: number;
  onSent?: (action: HeldAction) => void;
  onFailed?: (action: HeldAction, error: unknown) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export class HeldActionQueue {
  private current: HeldAction | null = null;
  private timer: unknown = null;
  private readonly options: HeldActionQueueOptions;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (timer: unknown) => void;

  constructor(options: HeldActionQueueOptions) {
    this.options = options;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  }

  get held(): HeldAction | null {
    return this.current;
  }

  /** Holds the action for the delay. One at a time: an action already held is sent right away. */
  hold(action: HeldAction): void {
    void this.flush();
    this.current = action;
    this.timer = this.setTimer(() => void this.flush(), this.options.delayMs);
  }

  /** Cancels the held action and returns it (null when nothing is held). */
  undo(): HeldAction | null {
    const action = this.take();
    return action;
  }

  /** Sends the held action now (leaving the screen, app to background). */
  async flush(): Promise<void> {
    const action = this.take();
    if (!action) return;
    try {
      await action.send();
      this.options.onSent?.(action);
    } catch (error) {
      this.options.onFailed?.(action, error);
    }
  }

  private take(): HeldAction | null {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const action = this.current;
    this.current = null;
    return action;
  }
}
