import type { Bundle, Dataset } from './data';
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
    if (d.fetchedAt && !Number.isFinite(Date.parse(d.fetchedAt)))
      throw Error('Invalid fetched time');
    if (
      [
        'hl_fees_daily',
        'dex_spot_market_share',
        'dex_perp_market_share',
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
        original.measures.some((key) => typeof row[key] === 'number'),
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
        status: (old.status === 'review'
          ? 'review'
          : 'stale') as Dataset['status'],
        note: old.note.includes('本轮来源失败或日期回退')
          ? old.note
          : old.note + ' 本轮来源失败或日期回退，保留上一有效快照。',
      };
    return d;
  });
  return { ...candidate, datasets };
}
