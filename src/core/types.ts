export type SelectItem = Record<string, any>;

/** Every text the component shows or announces, for translation. */
export interface SelectLabTexts {
  loading: string;
  error: string;
  retry: string;
  empty: string;
  remove: string;
  required: string;
}

export interface LoadParams {
  /** Current search term (already debounced). */
  search: string;
  /** Offset of the first row to fetch (server-side pagination). */
  offset: number;
  /** Page size. */
  limit: number;
  /** `nextCursor` from the previous page; `null` on the first page and when paginating by offset. */
  cursor: string | null;
  /** Aborted when a newer request supersedes this one. */
  signal: AbortSignal;
}

export interface LoadResult<T = SelectItem> {
  items: T[];
  /** Total number of matching rows. Optional — if absent, end-of-list is inferred from a short page. */
  total?: number;
  /** Cursor of the next page, `null` on the last one. When present, it decides end-of-list,
   *  and `total` only needs to come with the first page. */
  nextCursor?: string | null;
}

/**
 * The data contract. Return either `{ items, total? }` or a bare array
 * (bare array is compatible with services that just return `T[]`).
 */
export type DataSource<T = SelectItem> = (
  params: LoadParams
) => Promise<LoadResult<T> | T[]> | LoadResult<T> | T[];
