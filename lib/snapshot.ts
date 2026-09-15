import type { Bundle, Dataset } from './data';
const perpCohort = 'hl-core-hip3_dydx-v4_lighter-eth-v1';
const perpProtocols = ['Hyperliquid (Core + HIP-3)', 'dYdX v4', 'Lighter'];
export function validatePerpSample(d: Dataset) {
  if (!d.rows.length) return;
  if (d.unit !== '%' || d.source.url !== 'https://github.com/raymondhuang1994/web3-market-data-center/blob/main/docs/SAMPLE_SHARE.md')
    throw Error('Unapproved sample definition');
  const groups = new Map<string, typeof d.rows>();
  for (const r of d.rows) groups.set(String(r.date), [...(groups.get(String(r.date)) || []), r]);
  for (const rows of groups.values()) {
    if (rows.length !== 3 || new Set(rows.map(r => r.entity)).size !== 3 || rows.some(r =>
      !perpProtocols.includes(String(r.entity)) || r.cohortVersion !== perpCohort ||
      typeof r.volumeNominal !== 'number' || !Number.isFinite(r.volumeNominal) || r.volumeNominal < 0 ||
      typeof r.value !== 'number' || !Number.isFinite(r.value))) throw Error('Incomplete fixed sample');
    const total = rows.reduce((n,r) => n + (r.volumeNominal as number),0);
    if (total <= 0 || rows.some(r => Math.abs((r.value as number)-(r.volumeNominal as number)/total*100)>1e-7))
      throw Error('Invalid sample shares');
  }
}
export function validateBundle(
  input: unknown,
  baseline: Bundle,
  now = Date.now(),
): Bundle {
  if (!input || typeof input !== 'object') throw Error('Invalid bundle');
  const b = input as Bundle;
  if (
    b.schemaVersion !== 1 ||
    !Array.isArray(b.datasets) ||
    b.datasets.length !== baseline.datasets.length
  )
    throw Error('Invalid schema');
  if (typeof b.generatedAt !== 'string') throw Error('Invalid batch time');
  const generated = Date.parse(b.generatedAt);
  if (
    !Number.isFinite(generated) ||
    generated > now + 60000 ||
    generated < now - 86400000
  )
    throw Error('Invalid batch time');
  b.generatedAt = new Date(generated).toISOString();
  const seen = new Set<string>();
  const expected = new Map(baseline.datasets.map((d) => [d.id, d]));
  for (const d of b.datasets) {
    const original = expected.get(d.id);
    if (!original || seen.has(d.id))
      throw Error('Unknown or duplicate dataset');
    seen.add(d.id);
    if (d.id === 'dex_perp_market_share') validatePerpSample(d);
    if (original.status === 'review' && d.status === 'ready')
      throw Error('Unapproved quality promotion');
    if (
      !['ready', 'stale', 'pending', 'review'].includes(d.status) ||
      !Array.isArray(d.rows) ||
      d.rows.length > 1000
    )
      throw Error('Invalid dataset');
    if (
      typeof d.id !== 'string' ||
      typeof d.title !== 'string' ||
      typeof d.grain !== 'string' ||
      !d.source ||
      typeof d.source.name !== 'string' ||
      d.source.url !== original.source.url ||
      d.unit !== original.unit
    )
      throw Error('Unexpected source or unit');
    if (
      !Array.isArray(d.measures) ||
      !d.measures.every((x) => typeof x === 'string') ||
      !Array.isArray(d.dimensions) ||
      !d.dimensions.every((x) => typeof x === 'string') ||
      typeof d.note !== 'string' ||
      typeof d.fetchedAt !== 'string'
    )
      throw Error('Invalid metadata');
    if (
      d.asOf !== null &&
      (typeof d.asOf !== 'string' ||
        !Number.isFinite(Date.parse(d.asOf)) ||
        Date.parse(d.asOf) > now + 86400000)
    )
      throw Error('Invalid source date');
    if (
      d.collection &&
      (!['ok', 'failed', 'not-configured'].includes(d.collection.result) ||
        typeof d.collection.attemptedAt !== 'string' ||
        !Number.isFinite(Date.parse(d.collection.attemptedAt)) ||
        Date.parse(d.collection.attemptedAt) > now + 60000 ||
        (d.collection.error !== undefined &&
          (typeof d.collection.error !== 'string' ||
            d.collection.error.length > 2000)))
    )
      throw Error('Invalid collection audit');
    if (d.fetchedAt && !Number.isFinite(Date.parse(d.fetchedAt)))
      throw Error('Invalid fetched time');
    if (
      [
        'hl_fees_daily',
        'dex_spot_market_share',
        'cex_reserve_score',
      ].includes(d.id) &&
      d.rows.length
    )
      throw Error('Unapproved data source');
    if (d.rows.length && original.asOf && !d.asOf)
      throw Error('Missing source date');
    if (
      d.rows.length &&
      !d.rows.some((row) =>
        (original.rows.length ? original.measures : d.measures).some((key) => typeof row[key] === 'number'),
      )
    )
      throw Error('Missing measure');
    for (const row of d.rows) {
      if (!row || Array.isArray(row) || typeof row !== 'object')
        throw Error('Invalid row');
      for (const dimension of original.dimensions) {
        if (!(dimension in row)) throw Error('Missing dimension');
      }
      if (
        row.date !== undefined &&
        (typeof row.date !== 'string' || !Number.isFinite(Date.parse(row.date)))
      )
        throw Error('Invalid row date');
      for (const value of Object.values(row)) {
        if (
          (value !== null &&
            !['string', 'number', 'boolean'].includes(typeof value)) ||
          (typeof value === 'number' && !Number.isFinite(value))
        )
          throw Error('Invalid value');
      }
    }
    if (new TextEncoder().encode(JSON.stringify(d)).length > 1500000)
      throw Error('Dataset exceeds storage cap');
  }
  return b;
}
export function keepLastGood(candidate: Bundle, previous: Bundle): Bundle {
  const previousMap = new Map(previous.datasets.map((d) => [d.id, d]));
  const datasets = candidate.datasets.map((d) => {
    const old = previousMap.get(d.id);
    if (
      old?.rows.length &&
      (!d.rows.length ||
        (old.asOf && d.asOf && Date.parse(d.asOf) < Date.parse(old.asOf)))
    )
      return {
        ...old,
        collection: d.collection || old.collection,
        status: (old.status === 'review'
          ? 'review'
          : 'stale') as Dataset['status'],
        note: old.note.includes('本轮来源失败或日期回退')
          ? old.note
          : old.note + ' 本轮来源失败或日期回退，保留上一有效快照。',
      };
    if (d.id === 'dex_perp_market_share' && d.rows.length && old?.rows.length) {
      const cutoff = String(d.rows[0].date);
      const rows = [...old.rows.filter(r => String(r.date)<cutoff && r.cohortVersion===perpCohort), ...d.rows];
      const dates = [...new Set(rows.map(r => String(r.date)))].sort().slice(-180);
      return { ...d, rows:rows.filter(r => dates.includes(String(r.date))) };
    }
    return d;
  });
  return { ...candidate, datasets };
}
