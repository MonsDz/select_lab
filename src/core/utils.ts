/** Read a (optionally dotted) field path off an item. */
export function get(obj: any, path?: string): any {
  if (obj == null || !path) return undefined;
  if (path.indexOf('.') === -1) return obj[path];
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Heuristic: does this icon value point at an image rather than a glyph/emoji? */
export function looksLikeUrl(v: string): boolean {
  return (
    /^(https?:\/\/|\/|\.\/|data:image\/)/.test(v) ||
    /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(v)
  );
}
