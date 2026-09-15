import initial from '../data/bootstrap.json' with { type: 'json' };
import approved from '../data/source-registry.json' with { type: 'json' };
import type { Bundle, Dataset } from './data.ts';
const datasets = new Map((initial as unknown as Bundle).datasets.map(d => [d.id,d]));
for (const d of approved as unknown as Dataset[]) datasets.set(d.id,d);
const bootstrap: Bundle = { ...initial, datasets:[...datasets.values()] } as unknown as Bundle;
export default bootstrap;
