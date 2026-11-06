import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { baseStyles } from './styles';
import { get, looksLikeUrl } from './utils';
import { isSafeIconMarkup } from './safe-icon';
import { DataController } from './data-controller';
import { VirtualListController } from './virtual-list-controller';
import { PositioningController } from './positioning-controller';
import { DismissController } from './dismiss-controller';
import type { DataSource, SelectItem, LoadParams } from './types';

type Renderer = (item: SelectItem) => TemplateResult | string;
type IconRenderer = (item: SelectItem, iconValue: any) => TemplateResult | string | null | undefined;

let warnedAboutIconMarkup = false;

/**
 * Shared engine for the select family. `<select-lab>` (single) and
 * `<select-lab-multi>` (multiple) extend this and only flip `multiple`.
 */
export class SelectLabBase extends LitElement {
  static styles = baseStyles;
  static formAssociated = true;

  // ---- data source ----
  @property({ attribute: false }) dataSource?: DataSource;
  @property({ attribute: false }) items?: SelectItem[];
  @property({ type: String }) src?: string;
  @property({ attribute: 'search-param' }) searchParam = 'search';
  @property({ attribute: 'offset-param' }) offsetParam = 'skip';
  @property({ attribute: 'limit-param' }) limitParam = 'limit';

  // ---- field mapping ----
  @property({ attribute: 'value-field' }) valueField = 'id';
  @property({ attribute: 'label-field' }) labelField = 'label';
  @property({ attribute: 'description-field' }) descriptionField?: string;
  @property({ attribute: 'icon-field' }) iconField?: string;
  @property({ attribute: 'icon-color-field' }) iconColorField?: string;
  @property({ attribute: 'text-color-field' }) textColorField?: string;
  @property({ attribute: 'bg-field' }) bgField?: string;
  @property({ attribute: 'icon-type' }) iconType: 'auto' | 'image' | 'font' | 'emoji' = 'auto';
  /** Extra class on the icon glyph span — for consumers who also enable `inherit-styles`
   *  and target that class from their own stylesheet. */
  @property({ attribute: 'icon-font-class' }) iconFontClass?: string;
  /** Ligature icon font (Material Symbols/Icons, etc.) by family name — no CSS to write.
   *  Sets the `--sl-icon-font-family` token directly, which (unlike a class rule) pierces
   *  the shadow root because the underlying @font-face is registered globally. */
  @property({ attribute: 'icon-font-family' }) iconFontFamily?: string;
  /** Opt-in: clone the page's stylesheets into the shadow root so class-based icon
   *  fonts (Font Awesome, Bootstrap Icons…) work without rewriting their CSS. */
  @property({ type: Boolean, attribute: 'inherit-styles' }) inheritStyles = false;
  /** Render any markup found in an icon value, instead of only markup that can do nothing
   *  but draw an icon. Set it only when no icon value comes from user data. */
  @property({ type: Boolean, attribute: 'allow-icon-html' }) allowIconHtml = false;

  // ---- behavior ----
  @property({ type: Number, attribute: 'page-size' }) pageSize = 50;
  @property({ type: Number }) debounce = 300;
  @property({ type: Number, attribute: 'option-height' }) optionHeight = 44;
  @property({ type: Boolean }) searchable = true;
  /** Close the dropdown when the page or any ancestor scrolls outside it — matches
   *  native <select>/menu dismissal semantics ("anything outside the current flow
   *  closes it"). On by default. Scrolling *inside* the panel's own option list
   *  (used for pagination) never closes it. Set to false only if you specifically
   *  want the panel to follow the control while the page scrolls instead of closing. */
  @property({ type: Boolean, attribute: 'close-on-scroll' }) closeOnScroll = true;
  @property({ type: String }) placeholder = 'Select…';
  @property({ type: String, attribute: 'search-placeholder' }) searchPlaceholder = 'Search…';

  // ---- form / state ----
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) required = false;
  @property({ type: String, reflect: true }) name?: string;
  @property({ attribute: false }) value: any = null;
  @property({ type: Boolean, reflect: true }) open = false;

  // ---- escape hatches ----
  @property({ attribute: false }) renderOption?: Renderer;
  @property({ attribute: false }) renderLabel?: Renderer;
  /** Bring-your-own-icon-library hook: called with (item, iconFieldValue), scoped to
   *  just the icon slot (label/description layout stays intact). Return a Lit
   *  TemplateResult for full control (e.g. an inline SVG built by your icon library's
   *  own API), or a string (handled like the icon field: markup / url / glyph). */
  @property({ attribute: false }) iconRenderer?: IconRenderer;
  @property({ attribute: false }) resolveValue?: (
    value: any
  ) => Promise<SelectItem | undefined> | SelectItem | undefined;

  // ---- internal ----
  protected multiple = false;
  @state() private activeIndex = -1;
  @state() private _selected: SelectItem[] = [];

  private data: DataController;
  private virtual: VirtualListController;
  private positioning: PositioningController;
  private dismiss: DismissController;
  private internals: ElementInternals;

  @query('.control') private controlEl!: HTMLElement;
  @query('.panel') private panelEl!: HTMLElement | null;
  @query('.listbox') private listEl!: HTMLElement | null;
  @query('.search') private searchEl!: HTMLInputElement | null;

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.data = new DataController(this, { pageSize: this.pageSize, debounceMs: this.debounce });
    this.virtual = new VirtualListController(this);
    this.positioning = new PositioningController(this);
    this.dismiss = new DismissController(this, {
      onDismiss: () => this.close(),
      closeOnScroll: () => this.closeOnScroll, // live read, not a one-time snapshot
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    // support declarative <select-lab value="…"> for the single case
    if (!this.multiple && this.value == null && this.hasAttribute('value')) {
      this.value = this.getAttribute('value');
    }
  }

  // ---- effective data sources ----
  private srcDataSource = async ({ search, offset, limit, signal }: LoadParams) => {
    const url = new URL(this.src!, window.location.href);
    if (search) url.searchParams.set(this.searchParam, search);
    url.searchParams.set(this.offsetParam, String(offset));
    url.searchParams.set(this.limitParam, String(limit));
    const res = await fetch(url.toString(), { signal });
    const json = await res.json();
    if (Array.isArray(json)) return { items: json };
    if (Array.isArray(json?.items)) return { items: json.items, total: json.total };
    if (Array.isArray(json?.data)) return { items: json.data, total: json.total ?? json.count };
    return { items: [] };
  };

  private staticDataSource = ({ search, offset, limit }: LoadParams) => {
    let arr = this.items ?? [];
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((it) =>
        String(get(it, this.labelField) ?? '').toLowerCase().includes(q)
      );
    }
    return { items: arr.slice(offset, offset + limit), total: arr.length };
  };

  willUpdate(changed: PropertyValues) {
    if (changed.has('pageSize') || changed.has('debounce')) {
      this.data.setConfig({ pageSize: this.pageSize, debounceMs: this.debounce });
    }
    if (changed.has('dataSource') || changed.has('items') || changed.has('src')) {
      this.data.dataSource =
        this.dataSource ??
        (this.items ? this.staticDataSource : this.src ? this.srcDataSource : undefined);
      this.data.reset();
      if (this.open) this.data.ensureLoaded();
    }
    if (changed.has('optionHeight')) this.virtual.setRowHeight(this.optionHeight);
    if (changed.has('value') || changed.has('items')) void this.syncSelected();
    if (changed.has('iconFontFamily')) {
      // convenience attribute → the actual token, so consumers don't have to hand-write CSS
      if (this.iconFontFamily) this.style.setProperty('--sl-icon-font-family', this.iconFontFamily);
      else this.style.removeProperty('--sl-icon-font-family');
    }
  }

  updated(changed: PropertyValues) {
    if (changed.has('open')) {
      this.open ? this.onOpened() : this.onClosed();
    }
    // keep the virtual window in sync with whatever is currently scrolled/loaded
    if (this.open && this.listEl) {
      this.virtual.update(this.data.items.length, this.listEl.scrollTop, this.listEl.clientHeight);
    }
  }

  firstUpdated() {
    if (this.inheritStyles) this.adoptDocumentStyles();
  }

  /**
   * Clone the document's stylesheets into the shadow root, then re-append this
   * component's own styles last so they keep priority. Lets class-based icon
   * libraries (Font Awesome, Bootstrap Icons…) render inside the shadow DOM.
   */
  private adoptDocumentStyles() {
    const root = this.shadowRoot;
    if (!root) return;
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) =>
      root.appendChild(n.cloneNode(true))
    );
    const own = document.createElement('style');
    const s: any = (this.constructor as any).styles;
    own.textContent = Array.isArray(s) ? s.map((x) => x.cssText).join('\n') : (s?.cssText ?? '');
    root.appendChild(own);
  }

  // ---- open / close ----
  toggle = () => {
    if (this.disabled) return;
    this.open = !this.open;
  };

  close() {
    if (this.open) this.open = false;
  }

  private onOpened() {
    this.data.ensureLoaded();
    this.dismiss.activate();
    this.resetActive();
    this.updateComplete.then(() => {
      if (this.panelEl && this.controlEl) {
        this.positioning.maxHeight = 320;
        // if we're closing on outside scroll anyway, don't also chase the anchor —
        // avoids redundant repositioning work in the instant before the panel closes
        this.positioning.followScroll = !this.closeOnScroll;
        this.positioning.start(this.controlEl, this.panelEl);
      }
      if (this.searchEl) this.searchEl.focus();
      this.syncVirtual();
    });
    this.emit('open');
  }

  private onClosed() {
    this.positioning.stop();
    this.dismiss.deactivate();
    this.emit('close');
  }

  // ---- data / virtualization glue ----
  private syncVirtual() {
    if (this.listEl) {
      this.virtual.update(this.data.items.length, this.listEl.scrollTop, this.listEl.clientHeight);
    }
  }

  private onListScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    this.virtual.update(this.data.items.length, el.scrollTop, el.clientHeight);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - this.optionHeight * 3) {
      void this.data.loadMore();
    }
  };

  private onSearchInput = (e: Event) => {
    const term = (e.target as HTMLInputElement).value;
    this.data.setSearch(term);
    this.activeIndex = 0;
    if (this.listEl) this.listEl.scrollTop = 0;
    this.emit('search', { search: term });
  };

  // ---- keyboard ----
  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.open ? this.moveActive(1) : (this.open = true);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.open) this.moveActive(-1);
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.setActive(0);
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.setActive(this.data.items.length - 1);
        }
        break;
      case 'Enter':
        if (this.open) {
          e.preventDefault();
          const it = this.data.items[this.activeIndex];
          if (it) this.onOptionClick(it);
        } else {
          this.open = true;
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.close();
        }
        break;
      case 'Tab':
        if (this.open) this.close();
        break;
    }
  };

  private moveActive(dir: number) {
    const n = this.data.items.length;
    if (!n) return;
    let next = this.activeIndex + dir;
    if (next < 0) next = 0;
    if (next > n - 1) next = n - 1;
    this.setActive(next);
  }

  private setActive(i: number) {
    const n = this.data.items.length;
    if (!n) return;
    this.activeIndex = Math.max(0, Math.min(i, n - 1));
    this.scrollActiveIntoView();
    if (this.activeIndex >= n - 5) void this.data.loadMore();
  }

  private resetActive() {
    const idx = this._selected.length
      ? this.data.items.findIndex(
          (it) => get(it, this.valueField) === get(this._selected[0], this.valueField)
        )
      : -1;
    this.activeIndex = idx >= 0 ? idx : this.data.items.length ? 0 : -1;
  }

  private scrollActiveIntoView() {
    const el = this.listEl;
    if (!el) return;
    const top = this.activeIndex * this.optionHeight;
    const bottom = top + this.optionHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    this.virtual.update(this.data.items.length, el.scrollTop, el.clientHeight);
  }

  // ---- selection ----
  private isSelected(item: SelectItem): boolean {
    const v = get(item, this.valueField);
    if (this.multiple) return Array.isArray(this.value) && this.value.includes(v);
    return this.value === v;
  }

  private onOptionClick(item: SelectItem) {
    if (this.disabled) return;
    if (this.multiple) {
      this.isSelected(item) ? this.deselect(item) : this.addSelection(item);
      if (this.searchEl) this.searchEl.focus();
    } else {
      this.value = get(item, this.valueField);
      this._selected = [item];
      this.commit();
      this.close();
    }
  }

  private addSelection(item: SelectItem) {
    const v = get(item, this.valueField);
    const arr = Array.isArray(this.value) ? [...this.value] : [];
    if (!arr.includes(v)) arr.push(v);
    this.value = arr;
    this._selected = [...this._selected, item];
    this.commit();
  }

  private deselect(item: SelectItem) {
    const v = get(item, this.valueField);
    if (this.multiple) {
      this.value = (Array.isArray(this.value) ? this.value : []).filter((x) => x !== v);
    } else {
      this.value = null;
    }
    this._selected = this._selected.filter((s) => get(s, this.valueField) !== v);
    this.commit();
  }

  private commit() {
    this.updateFormValue();
    this.emitChange();
    this.requestUpdate();
  }

  private emitChange() {
    const detail = this.multiple
      ? { value: this.value, items: this._selected }
      : { value: this.value, item: this._selected[0] ?? null };
    this.emit('change', detail);
  }

  private emit(type: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  // ---- form association ----
  private updateFormValue() {
    if (this.multiple) {
      const fd = new FormData();
      for (const v of Array.isArray(this.value) ? this.value : []) {
        fd.append(this.name ?? '', String(v));
      }
      this.internals.setFormValue(fd);
    } else {
      this.internals.setFormValue(this.value == null ? null : String(this.value));
    }
    const empty = this.multiple
      ? !Array.isArray(this.value) || this.value.length === 0
      : this.value == null;
    if (this.required && empty) {
      this.internals.setValidity(
        { valueMissing: true },
        'Please select a value.',
        this.controlEl ?? undefined
      );
    } else {
      this.internals.setValidity({});
    }
  }

  private async syncSelected() {
    const values = this.multiple
      ? Array.isArray(this.value)
        ? this.value
        : []
      : this.value == null
        ? []
        : [this.value];
    if (!values.length) {
      this._selected = [];
      return;
    }
    const pool = [...(this.items ?? []), ...this.data.items, ...this._selected];
    const result: SelectItem[] = [];
    const missing: any[] = [];
    for (const v of values) {
      const found = pool.find((p) => get(p, this.valueField) === v);
      if (found) result.push(found);
      else missing.push(v);
    }
    this._selected = result;
    if (missing.length && this.resolveValue) {
      for (const v of missing) {
        try {
          const it = await this.resolveValue(v);
          if (it) this._selected = [...this._selected, it];
        } catch {
          /* ignore resolution errors */
        }
      }
      this.requestUpdate();
    }
  }

  private get hasValue(): boolean {
    return this.multiple ? Array.isArray(this.value) && this.value.length > 0 : this.value != null;
  }

  // ---- rendering ----
  render() {
    return html`
      <div
        class="control ${this.hasValue ? 'has-value' : ''}"
        part="control"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded=${this.open}
        aria-controls=${this.open ? 'sl-listbox' : nothing}
        aria-activedescendant=${this.open && this.activeIndex >= 0
          ? `sl-opt-${this.activeIndex}`
          : nothing}
        tabindex=${this.disabled ? -1 : 0}
        @click=${this.toggle}
        @keydown=${this.onKeyDown}
      >
        <slot name="prefix"></slot>
        <div class="value" part="value">${this.renderControlValue()}</div>
        <slot name="suffix"></slot>
        <span class="arrow" part="arrow" aria-hidden="true"></span>
      </div>
      ${this.open ? this.renderPanel() : nothing}
    `;
  }

  private renderControlValue() {
    if (this.multiple) {
      if (!this._selected.length)
        return html`<span class="placeholder" part="placeholder">${this.placeholder}</span>`;
      return html`<div class="chips">${this._selected.map((it) => this.renderChip(it))}</div>`;
    }
    const it = this._selected[0];
    if (!it) {
      if (this.value != null) return html`<span class="value-raw">${String(this.value)}</span>`;
      return html`<span class="placeholder" part="placeholder">${this.placeholder}</span>`;
    }
    if (this.renderLabel) return this.renderLabel(it);
    return this.renderItemInline(it, false);
  }

  private renderChip(item: SelectItem) {
    const iconVal = this.iconField ? get(item, this.iconField) : undefined;
    const iconColor = this.iconColorField ? get(item, this.iconColorField) : undefined;
    return html`
      <span class="chip" part="chip">
        ${this.renderIconSlot(item, iconVal, iconColor)}
        <span class="chip-label">${get(item, this.labelField)}</span>
        <button
          class="chip-x"
          part="chip-remove"
          type="button"
          aria-label="Remove"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.deselect(item);
          }}
        >
          ×
        </button>
      </span>
    `;
  }

  private renderPanel() {
    const items = this.data.items;
    const { start, end } = this.virtual;
    const slice = items.slice(start, end);
    const sizerH = items.length * this.optionHeight;
    return html`
      <div class="panel" part="panel">
        ${this.searchable
          ? html`
              <div class="search-wrap">
                <input
                  class="search"
                  part="input"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  .value=${this.data.search}
                  placeholder=${this.searchPlaceholder}
                  @input=${this.onSearchInput}
                  @keydown=${this.onKeyDown}
                  @click=${(e: Event) => e.stopPropagation()}
                />
              </div>
            `
          : nothing}
        <div
          class="listbox"
          id="sl-listbox"
          part="listbox"
          role="listbox"
          @scroll=${this.onListScroll}
        >
          <div class="sizer" style=${styleMap({ height: `${sizerH}px` })}>
            ${slice.map((item, i) => this.renderRow(item, start + i))}
          </div>
          ${this.data.loading
            ? html`<div class="status" part="loading">
                <span class="spinner"></span><slot name="loading">Loading…</slot>
              </div>`
            : nothing}
          ${!this.data.loading && this.data.error
            ? html`<div class="status" part="error"><slot name="error">Failed to load</slot></div>`
            : nothing}
          ${!this.data.loading && !this.data.error && items.length === 0
            ? html`<div class="status" part="empty"><slot name="empty">No results</slot></div>`
            : nothing}
        </div>
        <slot name="footer"></slot>
      </div>
    `;
  }

  private renderRow(item: SelectItem, index: number) {
    const selected = this.isSelected(item);
    const active = index === this.activeIndex;
    const bg = this.bgField ? get(item, this.bgField) : undefined;
    const style: Record<string, string> = {
      top: `${index * this.optionHeight}px`,
      height: `${this.optionHeight}px`,
    };
    if (bg) style.background = bg;
    return html`
      <div
        class="option ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}"
        part="option ${selected ? 'option-selected' : ''}"
        role="option"
        id="sl-opt-${index}"
        aria-selected=${selected}
        style=${styleMap(style)}
        @click=${() => this.onOptionClick(item)}
        @mousemove=${() => {
          if (this.activeIndex !== index) this.activeIndex = index;
        }}
      >
        ${this.renderOption ? this.renderOption(item) : this.renderItemInline(item, true)}
      </div>
    `;
  }

  private renderItemInline(item: SelectItem, showDesc: boolean) {
    const label = get(item, this.labelField);
    const desc = showDesc && this.descriptionField ? get(item, this.descriptionField) : undefined;
    const iconVal = this.iconField ? get(item, this.iconField) : undefined;
    const iconColor = this.iconColorField ? get(item, this.iconColorField) : undefined;
    const textColor = this.textColorField ? get(item, this.textColorField) : undefined;
    return html`
      ${this.renderIconSlot(item, iconVal, iconColor)}
      <span class="labels">
        <span class="label" part="option-label" style=${textColor ? `color:${textColor}` : nothing}
          >${label}</span
        >
        ${desc ? html`<span class="desc" part="option-description">${desc}</span>` : nothing}
      </span>
    `;
  }

  /**
   * Icon slot for one row. If `iconRenderer` is set it gets first refusal — return a
   * TemplateResult to hand-build the icon with your own library's API (e.g. an icon
   * library's `renderSVG()`/`createElement()` output), a string to reuse the built-in
   * markup/image/glyph auto-detection, or null/undefined to fall through to the
   * default `icon-field` behavior for that row.
   */
  private renderIconSlot(item: SelectItem, iconVal: any, iconColor: any) {
    if (this.iconRenderer) {
      const custom = this.iconRenderer(item, iconVal);
      if (custom != null && custom !== '') {
        return typeof custom === 'string' ? this.renderIcon(custom, iconColor) : custom;
      }
    }
    return iconVal != null && iconVal !== '' ? this.renderIcon(iconVal, iconColor) : nothing;
  }

  /**
   * Renders whatever the data carries, library-agnostic. In precedence order:
   *  1. markup ("<svg…>", "<i class='fa…'>", "<ion-icon…>") that passes isSafeIconMarkup,
   *     or any markup with `allow-icon-html`                                          → unsafeHTML
   *  2. image (url / data-uri / path)                                              → <img>
   *  3. glyph (emoji · ligature icon-font · unicode char)                          → text node,
   *     the icon-font applies via the --sl-icon-font-family token (@font-face is global,
   *     custom properties pierce Shadow DOM — unlike the utility class rules).
   */
  private renderIcon(value: any, color?: any) {
    const style = color ? `color:${color}` : nothing;
    const str = typeof value === 'string' ? value : String(value ?? '');

    if (str.trimStart().startsWith('<')) {
      if (!this.allowIconHtml && !isSafeIconMarkup(str)) {
        if (!warnedAboutIconMarkup) {
          warnedAboutIconMarkup = true;
          console.warn('select-lab: skipped icon markup that could do more than draw an icon. Set allow-icon-html only if no icon value comes from user data.');
        }
        return nothing;
      }
      return html`<span class="icon icon-html" part="option-icon" style=${style} aria-hidden="true"
        >${unsafeHTML(str)}</span
      >`;
    }

    const isImg = this.iconType === 'image' || (this.iconType === 'auto' && looksLikeUrl(str));
    if (isImg) {
      return html`<img class="icon icon-img" part="option-icon" src=${str} alt="" style=${style} />`;
    }

    const cls = this.iconFontClass ? `icon icon-glyph ${this.iconFontClass}` : 'icon icon-glyph';
    return html`<span class="${cls}" part="option-icon" style=${style} aria-hidden="true">${str}</span>`;
  }
}
