/* oxlint-disable next/no-html-link-for-pages */
import type { Bundle } from '@/lib/data';
import { sectorNames, type Sector } from '@/lib/analysis';
import { sourceTime } from '@/lib/quality';
export function AnalysisSummary({
  bundle,
  sector,
  report = false,
}: {
  bundle: Bundle;
  sector?: Sector;
  report?: boolean;
}) {
  const analysis = bundle.analysis;
  if (!analysis)
    return (
      <div className="summary-strip">
        <div>
          <h2>
            AI 市场解读{' '}
            <span className="summary-status">等待当日 Codex 解读</span>
          </h2>
          <p>
            每天基于同一批数据生成，目标香港时间 10:00 前与完整报告一同发布。
          </p>
        </div>
      </div>
    );
  const points = sector
    ? analysis.points.filter((p) => p.sector === sector)
    : analysis.points;
  return (
    <section className={report ? 'report-analysis' : 'analysis-summary'}>
      <div className="analysis-heading">
        <h2>
          AI 市场解读 <span className="summary-status">Codex</span>
        </h2>
        <span>
          {analysis.reportDate} · {sourceTime(analysis.generatedAt)} 生成
        </span>
      </div>
      <p className="analysis-method">
        数字由程序复算，解读与推断由 Codex 生成。数据范围和日期以各项证据为准。
      </p>
      <div className="analysis-grid">
        {points.map((p, i) => (
          <article key={p.sector + i} data-analysis-point={p.sector}>
            <span className="analysis-sector">{sectorNames[p.sector]}</span>
            <h3>{p.title}</h3>
            <p>{p.interpretation}</p>
            <p>
              <strong>业务观察：</strong>
              {p.implication}
            </p>
            <p>
              <strong>继续关注：</strong>
              {p.watch}
            </p>
            <details open={report || undefined}>
              <summary>数据证据与限制</summary>
              {p.factIds.map((id) => {
                const fact = analysis.facts.find((f) => f.id === id);
                return fact ? (
                  <div className="analysis-evidence" key={id}>
                    <p>{fact.statement}</p>
                    <p>
                      <a href={`/sources#${fact.datasetId}`}>{fact.title} ↗</a>{' '}
                      · 数据日期 {sourceTime(fact.asOf)} · 采集{' '}
                      {sourceTime(fact.fetchedAt)}
                    </p>
                    <p>{fact.limitation}</p>
                    <a href={fact.source.url} target="_blank" rel="noreferrer">
                      来源：{fact.source.name}
                    </a>
                  </div>
                ) : null;
              })}
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
