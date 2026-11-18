import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface DismissOptions {
  onDismiss: () => void;
  /** Also close when the user scrolls an ancestor or the window outside the component (default true).
   *  Pass a function to read a live/reactive value rather than a one-time snapshot. */
  closeOnScroll?: boolean | (() => boolean);
}

/** A scroll is the user's when a wheel or a finger moved outside the component this recently (ms). */
const SCROLL_INTENT_MS = 250;

/**
 * Closes the dropdown on any interaction outside the component — anything that
 * isn't part of using the select closes it: pointerdown outside (via composedPath,
 * so it works through Shadow DOM), Escape, and (by default) the user scrolling
 * anything other than the panel's own option list. The capture-phase window listener
 * sees scroll events from nested scrollable ancestors too (scroll doesn't bubble, but
 * capture-phase listeners on an ancestor still see it on the way down to its target).
 *
 * Only a scroll the user asked for closes it: one that follows a wheel or a finger
 * moving outside the component. The page also moves on its own — a phone keyboard
 * pushing the focused search into view (iOS), a focus, content loading — and closing
 * then made the list vanish right after opening; the panel follows its control instead.
 */
export class DismissController implements ReactiveController {
  private host: ReactiveControllerHost & HTMLElement;
  private opts: DismissOptions;
  private active = false;
  /** performance.now() of the last wheel or finger movement outside the component */
  private lastIntent = -Infinity;

  constructor(host: ReactiveControllerHost & HTMLElement, opts: DismissOptions) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  hostDisconnected() {
    this.deactivate();
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.lastIntent = -Infinity;
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('wheel', this.onScrollIntent, { capture: true, passive: true });
    document.addEventListener('touchmove', this.onScrollIntent, { capture: true, passive: true });
    // always attached; onScroll checks the live flag itself so toggling closeOnScroll
    // mid-session (a reactive property, not a one-time constructor snapshot) works
    window.addEventListener('scroll', this.onScroll, true);
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('wheel', this.onScrollIntent, { capture: true });
    document.removeEventListener('touchmove', this.onScrollIntent, { capture: true });
    window.removeEventListener('scroll', this.onScroll, true);
  }

  private get closeOnScrollEnabled(): boolean {
    const v = this.opts.closeOnScroll;
    return typeof v === 'function' ? v() : v !== false;
  }

  private isInside(e: Event): boolean {
    return e.composedPath().includes(this.host);
  }

  private onPointerDown = (e: Event) => {
    if (!this.isInside(e)) this.opts.onDismiss();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Escape closes this list only, not the dialog or drawer that contains it.
    e.preventDefault();
    e.stopPropagation();
    this.opts.onDismiss();
  };

  private onScrollIntent = (e: Event) => {
    if (!this.isInside(e)) this.lastIntent = performance.now();
  };

  private onScroll = (e: Event) => {
    if (!this.closeOnScrollEnabled || this.isInside(e)) return;
    if (performance.now() - this.lastIntent < SCROLL_INTENT_MS) this.opts.onDismiss();
  };
}
