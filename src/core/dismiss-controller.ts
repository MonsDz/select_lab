import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface DismissOptions {
  onDismiss: () => void;
  /** Also close when an ancestor/window scrolls outside the component (default true).
   *  Pass a function to read a live/reactive value rather than a one-time snapshot. */
  closeOnScroll?: boolean | (() => boolean);
}

/**
 * Closes the dropdown on any interaction outside the component — anything that
 * isn't part of using the select closes it: pointerdown outside (via composedPath,
 * so it works through Shadow DOM), Escape, and (by default) scrolling anything
 * other than the panel's own option list. The capture-phase window listener sees
 * scroll events from nested scrollable ancestors too (scroll doesn't bubble, but
 * capture-phase listeners on an ancestor still see it on the way down to its target).
 */
export class DismissController implements ReactiveController {
  private host: ReactiveControllerHost & HTMLElement;
  private opts: DismissOptions;
  private active = false;

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
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    // always attached; onScroll checks the live flag itself so toggling closeOnScroll
    // mid-session (a reactive property, not a one-time constructor snapshot) works
    window.addEventListener('scroll', this.onScroll, true);
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
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

  private onScroll = (e: Event) => {
    if (this.closeOnScrollEnabled && !this.isInside(e)) this.opts.onDismiss();
  };
}
