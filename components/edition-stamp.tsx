import type { Bundle } from '@/lib/data';
import { sourceTime } from '@/lib/quality';
import { editionStatus } from '@/lib/edition';
export function EditionStamp({
  bundle,
  report = false,
}: {
  bundle: Bundle;
  report?: boolean;
}) {
  const e = bundle.edition;
  if (!e) return null;
  return (
    <div className="edition-stamp">
      <strong>{e.reportDate} 日报 · 香港时间 09:00 截止</strong>
      <span>{e.calendar.label} · 周末及公众假期照常生成</span>
      <span>
        数据整理：{sourceTime(bundle.generatedAt)}
        {e.publishedAt ? ` · 完整发布：${sourceTime(e.publishedAt)}` : ''}
      </span>
      {!report && <span>{editionStatus(bundle)}</span>}
      <span>
        使用截止前取得的有效数据；各来源统计日期、实际采样时间及延迟分别标注。
      </span>
    </div>
  );
}
