import assert from 'node:assert';
import { DataController } from '../src/core/data-controller.ts';

// Minimal ReactiveControllerHost stand-in.
function fakeHost() {
  return { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) } as any;
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const range = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

let passed = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  console.log('  ✓ ' + msg);
  passed++;
};

// 1) Pagination with `total`: append pages, stop at the end.
{
  const all = range(25);
  const c = new DataController(fakeHost(), { pageSize: 10, debounceMs: 5 });
  c.dataSource = ({ offset, limit }) => ({ items: all.slice(offset, offset + limit), total: all.length });
  await c.reload();
  ok(c.items.length === 10 && c.hasMore === true, 'page 0 → 10 items, hasMore=true');
  await c.loadMore();
  ok(c.items.length === 20 && c.hasMore === true, 'page 1 → 20 items, hasMore=true');
  await c.loadMore();
  ok(c.items.length === 25 && c.hasMore === false, 'page 2 → 25 items, hasMore=false (via total)');
  await c.loadMore();
  ok(c.items.length === 25, 'loadMore past end is a no-op');
}

// 2) No `total`: end-of-list inferred from a short page.
{
  const all = range(25);
  const c = new DataController(fakeHost(), { pageSize: 10, debounceMs: 5 });
  c.dataSource = ({ offset, limit }) => all.slice(offset, offset + limit); // bare array, no total
  await c.reload();
  ok(c.items.length === 10 && c.hasMore === true, 'bare array full page → hasMore=true');
  await c.loadMore();
  await c.loadMore();
  ok(c.items.length === 25 && c.hasMore === false, 'short last page → hasMore=false (inferred)');
}

// 3) Debounced search resets to page 0 with filtered results.
{
  const all = range(100).map((r) => ({ id: r.id, name: r.id % 2 ? 'odd' : 'even' }));
  const c = new DataController(fakeHost(), { pageSize: 10, debounceMs: 20 });
  c.dataSource = ({ search, offset, limit }) => {
    const arr = search ? all.filter((r) => r.name.includes(search)) : all;
    return { items: arr.slice(offset, offset + limit), total: arr.length };
  };
  await c.reload();
  await c.loadMore(); // 20 loaded
  c.setSearch('even');
  await delay(40);
  ok(c.items.length === 10 && c.total === 50, 'search resets to page 0, new total applied');
  ok(c.items.every((r: any) => r.name === 'even'), 'search results are filtered');
}

// 4) Page cache: identical (search, offset) is fetched once.
{
  let calls = 0;
  const all = range(30);
  const c = new DataController(fakeHost(), { pageSize: 10, debounceMs: 5 });
  c.dataSource = ({ offset, limit }) => { calls++; return { items: all.slice(offset, offset + limit), total: 30 }; };
  await c.reload(); // offset 0
  await c.reload(); // offset 0 again → cache hit
  ok(calls === 1, 'second identical request served from cache (1 network call)');
}

// 5) Abort: a superseded request never clobbers the newer one.
{
  const c = new DataController(fakeHost(), { pageSize: 10, debounceMs: 5 });
  c.dataSource = ({ search, signal }) =>
    new Promise((resolve, reject) => {
      const slow = search === '';
      const t = setTimeout(() => resolve({ items: [{ id: search || 'first' }], total: 1 }), slow ? 40 : 10);
      signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
    });
  const first = c.reload();      // search '' → slow (40ms)
  c.search = 'second';
  const second = c.reload();     // aborts first, fast (10ms)
  await Promise.allSettled([first, second]);
  await delay(60);
  ok(c.items.length === 1 && (c.items[0] as any).id === 'second', 'aborted slow request did not overwrite newer result');
}

console.log(`\nAll ${passed} assertions passed.`);
