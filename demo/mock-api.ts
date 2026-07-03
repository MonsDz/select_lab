import type { LoadParams } from '../src/core/types';

export interface ClientRow {
  id: number;
  name: string;
  email: string;
  city: string;
  icon: string;
  color: string;
}

const FIRST = ['Ana', 'Luis', 'María', 'Carlos', 'Sofía', 'Diego', 'Lucía', 'Javier', 'Elena', 'Pablo', 'Marta', 'Hugo', 'Laura', 'Mateo', 'Carmen'];
const LAST = ['García', 'Rodríguez', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Díaz', 'Torres', 'Ruiz', 'Vargas', 'Castro', 'Romero'];
const CITY = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Bogotá', 'Lima', 'CDMX', 'Santiago'];
const ICONS = ['🧑‍💼', '👩‍💻', '🧑‍🔧', '👨‍🍳', '👩‍⚕️', '🧑‍🏫', '👨‍🌾', '👩‍🎨'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899'];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** Deterministic 10k-row dataset (so scrolling/searching is stable to eyeball). */
export const ROWS: ClientRow[] = Array.from({ length: 10_000 }, (_, i) => {
  const first = pick(FIRST, i * 7);
  const last = pick(LAST, i * 3 + 1);
  return {
    id: i + 1,
    name: `${first} ${last} #${i + 1}`,
    email: `${first}.${last}${i + 1}@example.com`.toLowerCase().replace(/[áéíóú]/g, (c) => 'aeiou'['áéíóú'.indexOf(c)]),
    city: pick(CITY, i * 2),
    icon: pick(ICONS, i),
    color: pick(COLORS, i),
  };
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulates a real paginated + searchable API with latency and abort support. */
export async function fetchClients({ search, offset, limit, signal }: LoadParams) {
  await delay(220);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  let arr = ROWS;
  if (search) {
    const q = search.toLowerCase();
    arr = arr.filter(
      (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
    );
  }
  return { items: arr.slice(offset, offset + limit), total: arr.length };
}
