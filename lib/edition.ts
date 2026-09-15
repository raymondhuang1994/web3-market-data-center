import type { Bundle, Dataset } from './data';

export const editionTimezone = 'Asia/Hong_Kong';
export function hongKongDate(now = Date.now()) {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
export function editionTimes(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error('Invalid report date');
  return {
    reportDate: date,
    cutoffAt: date + 'T01:00:00.000Z',
    deadlineAt: date + 'T02:00:00.000Z',
    timezone: editionTimezone,
  } as const;
}
export function knownBefore(d: Dataset, cutoff: number) {
  if (!d.rows.length) return true;
  if (
    !d.fetchedAt ||
    !Number.isFinite(Date.parse(d.fetchedAt)) ||
    Date.parse(d.fetchedAt) > cutoff
  )
    return false;
  if (d.asOf && Date.parse(d.asOf) > cutoff) return false;
  return d.rows.every((r) =>
    Object.entries(r).every(([key, value]) => {
      if (!/observed_at|timestamp|AsOf$/.test(key) || value === null)
        return true;
      const observed =
        typeof value === 'number'
          ? value * (value < 1e12 ? 1000 : 1)
          : typeof value === 'string'
            ? Date.parse(value)
            : NaN;
      return Number.isFinite(observed) && observed <= cutoff;
    }),
  );
}
export function enforceCutoff(bundle: Bundle, cutoffAt: string): Bundle {
  const cutoff = Date.parse(cutoffAt);
  if (!Number.isFinite(cutoff)) throw Error('Invalid cutoff');
  return {
    ...bundle,
    datasets: bundle.datasets.map((d) =>
      knownBefore(d, cutoff)
        ? d
        : {
            ...d,
            rows: [],
            status: 'pending',
            asOf: null,
            fetchedAt: '',
            note: '未取得本日报 09:00 截止前的有效快照；不使用截止后数据倒填。',
            collection: {
              attemptedAt: d.collection?.attemptedAt || bundle.generatedAt,
              result: 'failed',
              error: 'No eligible observation before 09:00 Asia/Hong_Kong',
            },
          },
    ),
  };
}
export function editionStatus(bundle: Bundle, now = Date.now()) {
  const today = hongKongDate(now);
  const deadline = Date.parse(editionTimes(today).deadlineAt);
  if (bundle.edition?.reportDate === today && bundle.edition.publishedAt)
    return Date.parse(bundle.edition.publishedAt) > deadline
      ? '今日完整日报已发布（晚于目标时间）'
      : '今日完整日报已发布';
  if (now >= deadline) return '今日日报延迟，继续显示上一完整版本';
  return '今日日报准备中，目标 10:00 前发布';
}
