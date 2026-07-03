// Register both custom elements.
import '../src/single/select-lab';
import '../src/multi/select-lab-multi';

import { fetchClients } from './mock-api';
import type { SelectLab } from '../src/single/select-lab';
import type { SelectLabMulti } from '../src/multi/select-lab-multi';

const single = document.getElementById('single') as SelectLab;
const multi = document.getElementById('multi') as SelectLabMulti;
const themed = document.getElementById('themed') as SelectLab;

// 1) Single + multi both hit the same paginated 10k-row mock API.
single.dataSource = fetchClients;
multi.dataSource = fetchClients;

// 2) Static, in-memory list (no pagination) driving a Material-Symbols icon select.
themed.items = [
  { value: 'draft', label: 'Draft', hint: 'Not sent yet', icon: 'edit_note' },
  { value: 'sent', label: 'Sent', hint: 'Awaiting response', icon: 'send' },
  { value: 'accepted', label: 'Accepted', hint: 'Client approved', icon: 'check_circle' },
  { value: 'rejected', label: 'Rejected', hint: 'Declined', icon: 'cancel' },
  { value: 'paid', label: 'Paid', hint: 'Settled', icon: 'paid' },
];

// Reflect the emitted value (proves display ≠ returned value).
const wire = (el: HTMLElement, outId: string) => {
  const out = document.getElementById(outId)!;
  el.addEventListener('change', (e: Event) => {
    out.textContent = 'value: ' + JSON.stringify((e as CustomEvent).detail.value);
  });
};
wire(single, 'single-out');
wire(multi, 'multi-out');
wire(themed, 'themed-out');
