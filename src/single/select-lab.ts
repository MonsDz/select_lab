import { SelectLabBase } from '../core/base-select';

/** Single-select. Emits a scalar value (the `value-field` of the chosen item). */
export class SelectLab extends SelectLabBase {}

if (!customElements.get('select-lab')) {
  customElements.define('select-lab', SelectLab);
}

declare global {
  interface HTMLElementTagNameMap {
    'select-lab': SelectLab;
  }
}
