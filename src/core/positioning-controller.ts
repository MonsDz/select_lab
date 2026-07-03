import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { computePosition, autoUpdate, offset, flip, shift, size } from '@floating-ui/dom';

/**
 * Places the dropdown panel with Floating UI using a fixed strategy so it
 * escapes ancestor `overflow: hidden`/scroll clipping, and keeps it glued to
 * the control on scroll/resize (no manual "close on scroll" hack needed).
 */
export class PositioningController implements ReactiveController {
  private host: ReactiveControllerHost;
  private cleanup?: () => void;

  maxHeight = 320;
  /** Whether to keep repositioning while an ancestor scrolls. Set false when the
   *  consumer closes on outside scroll instead (the default) — no point chasing
   *  an anchor the panel is about to be dismissed from. */
  followScroll = true;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostDisconnected() {
    this.stop();
  }

  start(reference: HTMLElement, floating: HTMLElement) {
    this.stop();
    this.cleanup = autoUpdate(reference, floating, () => this.reposition(reference, floating), {
      ancestorScroll: this.followScroll,
    });
  }

  private async reposition(reference: HTMLElement, floating: HTMLElement) {
    const { x, y } = await computePosition(reference, floating, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [
        offset(4),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        size({
          padding: 8,
          apply: ({ availableHeight, rects }) => {
            Object.assign(floating.style, {
              maxHeight: `${Math.max(160, Math.min(this.maxHeight, availableHeight))}px`,
              minWidth: `${rects.reference.width}px`,
            });
          },
        }),
      ],
    });
    Object.assign(floating.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
    });
  }

  stop() {
    this.cleanup?.();
    this.cleanup = undefined;
  }
}
