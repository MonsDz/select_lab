import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Fixed-height windowing: keeps only the visible rows (+ overscan) in the DOM,
 * so the option list stays ~30 nodes even when the buffer holds thousands.
 */
export class VirtualListController implements ReactiveController {
  private host: ReactiveControllerHost;

  rowHeight = 44;
  overscan = 6;

  start = 0;
  end = 0;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected() {}

  setRowHeight(h: number) {
    if (h > 0 && h !== this.rowHeight) this.rowHeight = h;
  }

  /** Recompute the visible window from the current scroll position. */
  update(total: number, scrollTop: number, viewportHeight: number) {
    const first = Math.floor(scrollTop / this.rowHeight);
    const visible = Math.ceil(viewportHeight / this.rowHeight);
    const start = Math.max(0, first - this.overscan);
    const end = Math.min(total, first + visible + this.overscan);
    if (start !== this.start || end !== this.end) {
      this.start = start;
      this.end = end;
      this.host.requestUpdate();
    }
  }
}
