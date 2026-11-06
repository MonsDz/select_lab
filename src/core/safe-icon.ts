import { looksLikeUrl } from './utils';

const SVG_NS = 'http://www.w3.org/2000/svg';

const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'title', 'desc',
]);
const SVG_ATTRS = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'viewbox', 'preserveaspectratio', 'width', 'height',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'opacity',
  'fill', 'fill-rule', 'fill-opacity', 'clip-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-miterlimit', 'stroke-opacity',
  'class', 'role', 'focusable', 'aria-hidden', 'aria-label',
]);
const GLYPH_ATTRS = new Set(['class', 'aria-hidden']);
const IMG_ATTRS = new Set(['src', 'alt', 'class', 'width', 'height', 'loading', 'aria-hidden']);
const CUSTOM_ELEMENT_ATTRS = new Set([
  'name', 'icon', 'size', 'color', 'variant', 'library', 'flip', 'rotate', 'width', 'height',
  'class', 'aria-hidden', 'aria-label',
]);
const CUSTOM_ELEMENT_TAG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const PLAIN_VALUE = /^[\w:. -]*$/;
const CACHE_LIMIT = 500;

const verdicts = new Map<string, boolean>();

const hasOnlyAttrs = (el: Element, allowed: Set<string>) =>
  Array.from(el.attributes).every((attr) => allowed.has(attr.name.toLowerCase()));

function isSafeSvg(root: Element): boolean {
  return [root, ...Array.from(root.querySelectorAll('*'))].every(
    (el) =>
      el.namespaceURI === SVG_NS &&
      SVG_TAGS.has(el.localName) &&
      Array.from(el.attributes).every((attr) => {
        const name = attr.name.toLowerCase();
        return (SVG_ATTRS.has(name) || name.startsWith('data-')) && !/url\(|script:/i.test(attr.value);
      })
  );
}

function check(markup: string): boolean {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const nodes = Array.from(template.content.childNodes).filter(
    (node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim()
  );
  if (nodes.length !== 1 || nodes[0].nodeType !== Node.ELEMENT_NODE) return false;

  const root = nodes[0] as Element;
  if (root.namespaceURI === SVG_NS) return root.localName === 'svg' && isSafeSvg(root);
  if (root.children.length) return false;

  const tag = root.localName;
  if (tag === 'i' || tag === 'span') return hasOnlyAttrs(root, GLYPH_ATTRS);
  if (tag === 'img') return hasOnlyAttrs(root, IMG_ATTRS) && looksLikeUrl(root.getAttribute('src') ?? '');
  return (
    CUSTOM_ELEMENT_TAG.test(tag) &&
    hasOnlyAttrs(root, CUSTOM_ELEMENT_ATTRS) &&
    Array.from(root.attributes).every((attr) => PLAIN_VALUE.test(attr.value))
  );
}

/**
 * Whether icon markup can only draw an icon: plain SVG shapes, an empty `<i>`/`<span>`
 * glyph, an `<img>`, or an icon-library tag such as `<ion-icon name="home">`. Anything
 * else needs `allow-icon-html`, because icon values usually come from data.
 *
 * Checks the tree the HTML parser builds from this exact string, and the renderer parses
 * the same string the same way, so a value cannot change meaning between the two.
 */
export function isSafeIconMarkup(markup: string): boolean {
  let verdict = verdicts.get(markup);
  if (verdict === undefined) {
    verdict = check(markup);
    if (verdicts.size >= CACHE_LIMIT) verdicts.clear();
    verdicts.set(markup, verdict);
  }
  return verdict;
}
