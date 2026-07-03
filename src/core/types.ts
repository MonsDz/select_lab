export type SelectItem = Record<string, any>;

export interface LoadParams {
  /** Current search term (already debounced). */
  search: string;
  /** Offset of the first row to fetch (server-side pagination). */
  offset: number;
  /** Page size. */
  limit: number;
  /** Aborted when a newer request supersedes this one. */
  signal: AbortSignal;
}

export interface LoadResult<T = SelectItem> {
  items: T[];
  /** Total number of matching rows. Optional — if absent, end-of-list is inferred from a short page. */
  total?: number;
}

/**
 * The data contract. Return either `{ items, total? }` or a bare array
 * (bare array is compatible with services that just return `T[]`).
 */
export type DataSource<T = SelectItem> = (
  params: LoadParams
) => Promise<LoadResult<T> | T[]> | LoadResult<T> | T[];
