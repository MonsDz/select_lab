import { css } from 'lit';

/**
 * All colors/sizes are CSS custom properties (design tokens) so consumers can
 * theme without `!important`. Every structural node also exposes a `part`.
 */
export const baseStyles = css`
  :host {
    /* ---- tokens (light) ---- */
    --sl-font: inherit;
    --sl-radius: 10px;
    --sl-control-bg: #ffffff;
    --sl-control-border: #d4d4d8;
    --sl-control-border-hover: #a1a1aa;
    --sl-control-min-height: 40px;
    --sl-text: #18181b;
    --sl-muted: #71717a;
    --sl-placeholder: #6b7280;
    --sl-accent: #6366f1;
    --sl-focus-ring: rgba(99, 102, 241, 0.35);
    --sl-panel-bg: #ffffff;
    --sl-panel-border: #e4e4e7;
    --sl-panel-radius: 12px;
    --sl-panel-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    --sl-option-hover-bg: #f4f4f5;
    --sl-option-selected-bg: rgba(99, 102, 241, 0.1);
    --sl-option-selected-text: #4338ca;
    --sl-icon-color: currentColor;
    --sl-chip-bg: rgba(99, 102, 241, 0.12);
    --sl-chip-text: #4338ca;

    display: inline-block;
    width: 100%;
    font-family: var(--sl-font);
    color: var(--sl-text);
    box-sizing: border-box;
  }

  :host([theme='dark']),
  :host-context(.dark) {
    --sl-control-bg: #18181b;
    --sl-control-border: #3f3f46;
    --sl-control-border-hover: #52525b;
    --sl-text: #f4f4f5;
    --sl-muted: #a1a1aa;
    --sl-placeholder: #a1a1aa;
    --sl-panel-bg: #18181b;
    --sl-panel-border: #27272a;
    --sl-panel-shadow: 0 12px 34px rgba(0, 0, 0, 0.5);
    --sl-option-hover-bg: #27272a;
    --sl-option-selected-bg: rgba(129, 140, 248, 0.16);
    --sl-option-selected-text: #c7d2fe;
    --sl-chip-bg: rgba(129, 140, 248, 0.18);
    --sl-chip-text: #c7d2fe;
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([theme='light'])) {
      --sl-control-bg: #18181b;
      --sl-control-border: #3f3f46;
      --sl-control-border-hover: #52525b;
      --sl-text: #f4f4f5;
      --sl-muted: #a1a1aa;
      --sl-placeholder: #a1a1aa;
      --sl-panel-bg: #18181b;
      --sl-panel-border: #27272a;
      --sl-panel-shadow: 0 12px 34px rgba(0, 0, 0, 0.5);
      --sl-option-hover-bg: #27272a;
      --sl-option-selected-bg: rgba(129, 140, 248, 0.16);
      --sl-option-selected-text: #c7d2fe;
      --sl-chip-bg: rgba(129, 140, 248, 0.18);
      --sl-chip-text: #c7d2fe;
    }
  }

  :host([disabled]) {
    opacity: 0.6;
    pointer-events: none;
  }

  * {
    box-sizing: border-box;
  }

  /* ---- control ---- */
  .control {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--sl-control-min-height);
    padding: 4px 10px;
    background: var(--sl-control-bg);
    /* longhand, not the border shorthand: shorthands referencing a var() can fail to
       re-resolve when the custom property changes via an ancestor selector outside the
       shadow tree (e.g. toggling a .dark class on <html>) — longhand recomputes reliably. */
    border-width: 1px;
    border-style: solid;
    border-color: var(--sl-control-border);
    border-radius: var(--sl-radius);
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    outline: none;
  }
  .control:hover {
    border-color: var(--sl-control-border-hover);
  }
  /* Accent border: while open/focused, AND persistently once a value is set
     (a "filled field" affordance) — not just during interaction. */
  .control.has-value {
    border-color: var(--sl-filled-border, var(--sl-accent));
    box-shadow: var(--sl-filled-shadow, 0 0 0 3px var(--sl-focus-ring));
  }
  .control:focus-visible,
  :host([open]) .control {
    border-color: var(--sl-accent);
    box-shadow: 0 0 0 3px var(--sl-focus-ring);
  }
  /* A filled field already wears the ring above, so keyboard focus needs its own mark. */
  .control:focus-visible {
    outline: var(--sl-focus-outline, 2px solid var(--sl-accent));
    outline-offset: 2px;
  }
  :host([invalid]) .control {
    border-color: var(--sl-invalid-border, #dc2626);
  }

  .value {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }
  .value > .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .placeholder {
    color: var(--sl-placeholder);
  }
  .value-raw {
    color: var(--sl-muted);
  }

  .arrow {
    flex: none;
    width: 10px;
    height: 10px;
    border-right: 2px solid var(--sl-muted);
    border-bottom: 2px solid var(--sl-muted);
    transform: rotate(45deg) translate(-1px, -1px);
    transition: transform 0.18s ease;
  }
  :host([open]) .arrow {
    transform: rotate(-135deg) translate(-2px, -2px);
  }

  /* ---- chips (multi) ---- */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px 2px 8px;
    background: var(--sl-chip-bg);
    color: var(--sl-chip-text);
    border-radius: 6px;
    font-size: 0.82rem;
    max-width: 100%;
  }
  .chip-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip-x {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 2px;
    border-radius: 4px;
    opacity: 0.7;
  }
  .chip-x:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.08);
  }

  /* ---- panel ---- */
  .panel {
    position: fixed;
    z-index: 2147483000;
    display: flex;
    flex-direction: column;
    background: var(--sl-panel-bg);
    border-width: 1px;
    border-style: solid;
    border-color: var(--sl-panel-border);
    border-radius: var(--sl-panel-radius);
    box-shadow: var(--sl-panel-shadow);
    overflow: hidden;
    max-height: 320px;
  }

  .search-wrap {
    padding: 8px;
    border-bottom-width: 1px;
    border-bottom-style: solid;
    border-bottom-color: var(--sl-panel-border);
  }
  .search {
    width: 100%;
    padding: 8px 10px;
    border-width: 1px;
    border-style: solid;
    border-color: var(--sl-control-border);
    border-radius: 8px;
    background: var(--sl-control-bg);
    color: var(--sl-text);
    font: inherit;
    outline: none;
  }
  .search:focus {
    border-color: var(--sl-accent);
    box-shadow: 0 0 0 3px var(--sl-focus-ring);
  }

  .listbox {
    flex: 1 1 auto;
    min-height: 0;
    max-height: 300px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .sizer {
    position: relative;
    width: 100%;
  }

  /* ---- option ---- */
  .option {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    cursor: pointer;
    color: var(--sl-text);
  }
  .option:hover,
  .option.is-active {
    background: var(--sl-option-hover-bg);
  }
  .option.is-selected {
    background: var(--sl-option-selected-bg);
    color: var(--sl-option-selected-text);
  }

  .labels {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
  }
  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.9rem;
  }
  .desc {
    font-size: 0.75rem;
    color: var(--sl-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon {
    flex: none;
    color: var(--sl-icon-color);
  }
  /* Emoji / ligature icon-font / unicode glyph. Set --sl-icon-font-family to use a
     web icon font (Material Symbols, etc.) — the @font-face is global so it reaches
     into the shadow DOM; unset, it inherits normally so emoji render as-is. */
  .icon-glyph {
    font-family: var(--sl-icon-font-family);
    font-weight: var(--sl-icon-font-weight, normal);
    font-style: normal;
    font-size: var(--sl-icon-size, 20px);
    line-height: 1;
    width: var(--sl-icon-size, 22px);
    text-align: center;
    letter-spacing: normal;
    text-transform: none;
    white-space: nowrap;
    direction: ltr;
    font-feature-settings: 'liga';
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  /* Raw markup: inline SVG, <i class="fa…">, <ion-icon>, etc. Inherits color so
     SVGs using fill="currentColor" pick up --sl-icon-color / per-item color. */
  .icon-html {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sl-icon-size, 22px);
    height: var(--sl-icon-size, 22px);
    font-size: var(--sl-icon-size, 20px);
  }
  .icon-html svg {
    width: 1em;
    height: 1em;
    display: block;
  }
  .icon-html img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .icon-img {
    width: var(--sl-icon-size, 20px);
    height: var(--sl-icon-size, 20px);
    object-fit: cover;
    border-radius: 4px;
  }

  /* ---- status rows ---- */
  .status-region {
    position: relative;
  }
  .status {
    padding: 10px 12px;
    font-size: 0.82rem;
    color: var(--sl-muted);
    text-align: center;
  }
  /* Loading another page floats over the list, so the rows don't jump. */
  .status.is-floating {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--sl-panel-bg);
  }
  .retry {
    margin-inline-start: 6px;
    padding: 2px 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--sl-text);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 6px;
    border-width: 2px;
    border-style: solid;
    border-color: var(--sl-muted);
    border-top-color: transparent;
    border-radius: 50%;
    vertical-align: -2px;
    animation: sl-spin 0.7s linear infinite;
  }
  @keyframes sl-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .control,
    .arrow {
      transition: none;
    }
    .spinner {
      animation-duration: 2.4s;
    }
  }
`;
