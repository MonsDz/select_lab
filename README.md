# select-lab

[![npm version](https://img.shields.io/npm/v/select-lab.svg)](https://www.npmjs.com/package/select-lab)
[![license: MIT](https://img.shields.io/npm/l/select-lab.svg)](./LICENSE)

Framework-agnostic **super-select web components** — one codebase, usable from Angular, Vue, Svelte and plain HTML/JS via the `<select-lab>` / `<select-lab-multi>` custom elements.

Built for the case a native `<select>` (and even select2 / ng-select) struggles with:

- **Continuous server-side pagination** over 10k–15k+ rows (infinite scroll + row virtualization, so the DOM stays ~30 nodes).
- **Debounced field search** with in-flight request cancellation and page caching.
- **Data-driven icons & colors** per option (icon, icon color, text color, background — from your data, not hardcoded) — with adapters for emoji, raw SVG, any icon library that ships a custom element (`<ion-icon>`, `<iconify-icon>`, …), and ligature icon fonts. See [Icons](#icons).
- **Display ≠ value**: show `name + description + icon`, return just the `id`.
- **Closes on anything outside the flow** — click outside, Escape, or scrolling the page/an ancestor — on by default. No detach, no manual scroll listeners to wire up yourself.
- **Real form control** (`ElementInternals`, `formAssociated`) + ARIA combobox keyboard support. See [Accessibility](#accessibility).
- **Themeable** via CSS custom properties and `::part()` — no `!important`, plugs into whatever design system the host app already has.

## Install

```bash
npm install select-lab lit @floating-ui/dom
```

`lit` and `@floating-ui/dom` are peer runtime deps (keeps the lib lean and dedupes across your app).

## Quick start (vanilla)

```html
<select-lab id="clients" value-field="id" label-field="name"
  description-field="email" icon-field="icon" icon-color-field="color"
  placeholder="Search client…"></select-lab>

<script type="module">
  import 'select-lab/single'; // registers <select-lab>

  const el = document.getElementById('clients');
  el.dataSource = async ({ search, offset, limit, signal }) => {
    const r = await fetch(`/api/clients?search=${search}&skip=${offset}&limit=${limit}`, { signal });
    return { items: await r.json() };      // bare array also accepted; `total` optional
  };
  el.addEventListener('change', (e) => console.log(e.detail.value)); // the id
</script>
```

Pure-HTML alternative (library does the fetch):

```html
<select-lab src="/api/clients" search-param="search" offset-param="skip"
  limit-param="limit" value-field="id" label-field="name"></select-lab>
```

## Entry points

| Import | Registers | Value |
| --- | --- | --- |
| `select-lab/single` | `<select-lab>` | scalar (the chosen `value-field`) |
| `select-lab/multi` | `<select-lab-multi>` | array of `value-field`s (renders chips) |
| `select-lab` | both | — |
| `select-lab/core` | — | `SelectLabBase` + types (build your own) |

## Data contract

```ts
type LoadParams  = { search: string; offset: number; limit: number; cursor: string | null; signal: AbortSignal };
type DataSource  = (p: LoadParams) => Promise<{ items: T[]; total?: number; nextCursor?: string | null } | T[]>;
```

- Return `{ items, total }` for an exact end-of-list; or a **bare `T[]`** (compatible with services that already return arrays) — end-of-list is then inferred from a short page.
- **Cursor (keyset) pagination:** return `nextCursor`, and `null` on the last page. You receive it back as `cursor` on the next request. The cost of a page stays flat however deep the user scrolls, unlike `OFFSET`. `total` is optional and only needs to come with the first page.
- `.items = [...]` (a static array property) turns it into a normal in-memory select (client-side filter, no pagination).

## Icons

Works with whatever icon system your app already has — no rewrite needed. `icon-field` auto-detects the shape of the value; for full control, `.iconRenderer` calls straight into your own icon library's API.

Icon values usually come from data, so markup only renders when it can do nothing but draw an icon: plain SVG shapes, an empty `<i>`/`<span>` glyph, an `<img>`, or an icon-library tag with plain attributes. Scripts, event handlers, links, styles and other tags are skipped, with one console warning. If no icon value comes from user data and you need other markup, set `allow-icon-html`. A `TemplateResult` from `.iconRenderer` is your own code, so it always renders.

| Your icon data looks like… | How to wire it |
| --- | --- |
| Emoji / plain glyph (`"🧑‍💼"`) | Nothing to configure — just `icon-field`. |
| An image URL / `data:` URI | Auto-detected, rendered as `<img>`. |
| Inline SVG markup (`"<svg…>…</svg>"`) | Auto-detected, injected as real DOM (not escaped text). |
| A tag from a custom-element icon library (`"<ion-icon name='home'>"`, `<iconify-icon>`, …) | Same auto-detection — if that library registered its element globally, it upgrades inside the shadow root for free (the custom element registry isn't scoped per shadow tree). |
| A ligature icon font (Material Symbols/Icons, …) | `icon-font-family="Material Symbols Rounded"` — no CSS to write. Unlike a plain CSS class, this correctly reaches through the Shadow DOM. |
| A class-based icon font (Font Awesome, Bootstrap Icons, …) | `inherit-styles` clones the page's stylesheets into the shadow root, or resolve the glyph yourself upstream. |
| Anything your own JS API can render | `.iconRenderer = (item, iconValue) => …` — return a Lit `TemplateResult` or a markup string; full control, any icon library. |

Framework **components** (Angular `<mat-icon>`, a Vue/Svelte icon component) can't be injected this way — they need their framework's own compiler attached to the node. Resolve them to one of the forms above upstream (most icon libraries already expose a raw-SVG or unicode form for exactly this reason).

## Key attributes / properties

| Attr / prop | Default | Purpose |
| --- | --- | --- |
| `value-field` | `id` | field returned as the value |
| `label-field` | `label` | primary text |
| `description-field` | — | optional second line |
| `icon-field` / `icon-color-field` | — | per-item icon + its color |
| `text-color-field` / `bg-field` | — | per-item text color / row background |
| `icon-type` | `auto` | `auto` \| `image` \| `font` \| `emoji` |
| `icon-font-family` | — | ligature icon font by family name (see [Icons](#icons)) |
| `icon-font-class` | — | extra class on the icon glyph, for use with `inherit-styles` |
| `inherit-styles` | `false` | clone the page's stylesheets into the shadow root (class-based icon fonts) |
| `allow-icon-html` | `false` | render any markup in an icon value (see [Icons](#icons)); only when no icon value comes from user data |
| `label` | — | accessible name (see [Accessibility](#accessibility)) |
| `described-by` | — | space-separated ids of the elements that describe the field, such as a hint or an error |
| `invalid` | `false` | marks the field as invalid, for screen readers and with `--sl-invalid-border` |
| `.texts` | English | translations: `{ loading, error, retry, empty, remove, required }` |
| `page-size` | `50` | rows per request |
| `debounce` | `300` | search debounce (ms) |
| `option-height` | `44` | fixed row height (px) — used by virtualization |
| `close-on-scroll` | `true` | close when the page/an ancestor scrolls outside the select; set `false` to have the panel follow the control instead |
| `.dataSource` / `src` / `.items` | — | data (see [Data contract](#data-contract)) |
| `.renderOption` / `.renderLabel` | — | full custom row/label templates (power users) |
| `.iconRenderer(item, iconValue)` | — | full custom icon rendering (power users, any icon library's own API) |
| `.resolveValue(value)` | — | hydrate a preselected value not in the buffer |

**Events:** `change` (`{ value, item }` or `{ value, items }`), `search`, `open`, `close`.

## Theming

Override CSS custom properties, or target internals with `::part()`:

```css
select-lab { --sl-accent: #10b981; --sl-radius: 12px; }
select-lab::part(panel)  { border-radius: 16px; }
select-lab::part(option) { padding-inline: 16px; }
```

A field with a value keeps the accent ring by default. To match other inputs, set `--sl-filled-border` and `--sl-filled-shadow` (the look with a value), and `--sl-focus-outline` (the extra mark on keyboard focus).

Dark mode follows `prefers-color-scheme`; force it with `theme="dark"` / `theme="light"`.

## Accessibility

- **Name:** taken from `label`, then from an associated `<label for>`, then from the placeholder. A `<label>` also focuses the field when clicked.
- **Keyboard:** arrows, Home, End, Enter and Space, with Tab moving on to the next field. Escape closes only the list, so a dialog or drawer around it stays open. Focus returns to the field after choosing or closing.
- **Screen readers:** options report their position in the whole list, even while virtualized, and loading, empty and error states are announced.
- **Errors:** a failed load offers a retry, by button or Enter, and reopening retries too.

## Framework usage

**Angular** — allow the custom element, bind the `.dataSource` property and the `change` event:

```ts
@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] }) // or in a standalone component
```
```html
<select-lab [dataSource]="loadClients" value-field="id" label-field="name"
  (change)="onChange($event)"></select-lab>
```
```ts
loadClients = ({ search, offset, limit }) =>
  firstValueFrom(this.clientService.getClients(offset, limit, search)); // already returns Client[]
```
> A `ControlValueAccessor` adapter (for reactive forms / `ngModel`) is planned as `select-lab/angular`.

**Vue** — treat it as a custom element, then `v-model`-style bind:

```ts
// vite: app.config.compilerOptions.isCustomElement = t => t.startsWith('select-lab')
```
```html
<select-lab :value-field="'id'" label-field="name"
  :.dataSource="loadClients" @change="v = $event.detail.value" />
```

**Svelte** — works natively:

```svelte
<select-lab label-field="name" bind:this={el} on:change={(e) => (v = e.detail.value)} />
<script>onMount(() => (el.dataSource = loadClients));</script>
```

## Develop & test

```bash
npm run dev            # demo harness at http://localhost:5173 (10k-row mock API)
npm run build          # tree-shakeable ESM library → dist/
npm run typecheck
npm test               # DataController engine (pagination/search/cache/abort)
npm run test:browser   # drives the real UI in Chrome (needs the dev server running)
npm run test:a11y      # axe audit, keyboard, focus and screen-reader wiring
npm run test:compat    # what existing integrations rely on
npm run test:icons     # icon values that must never run code
```

## Contributing

Bug reports, fixes and ideas are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to get set up and what to run before opening a PR.

## License

MIT © [MonsDz](https://github.com/MonsDz) — see [LICENSE](./LICENSE).

## Security

See [SECURITY.md](./SECURITY.md) for how to report a vulnerability.

## Links

- Repository: [github.com/MonsDz/select_lab](https://github.com/MonsDz/select_lab)
- Issues: [github.com/MonsDz/select_lab/issues](https://github.com/MonsDz/select_lab/issues)
