// Convenience entry: registers both elements. For tree-shaking, import
// `select-lab/single` or `select-lab/multi` individually instead.
export { SelectLab } from './single/select-lab';
import './single/select-lab';
export { SelectLabMulti } from './multi/select-lab-multi';
import './multi/select-lab-multi';

export { SelectLabBase } from './core/base-select';
export type { DataSource, LoadParams, LoadResult, SelectItem, SelectLabTexts } from './core/types';
