import { SelectLabBase } from '../core/base-select';

/** Multi-select. `value` is an array of `value-field`s; renders removable chips. */
export class SelectLabMulti extends SelectLabBase {
  constructor() {
    super();
    this.multiple = true;
    this.value = [];
    this.placeholder = 'Select…';
  }
}

if (!customElements.get('select-lab-multi')) {
  customElements.define('select-lab-multi', SelectLabMulti);
}

declare global {
  interface HTMLElementTagNameMap {
    'select-lab-multi': SelectLabMulti;
  }
}
