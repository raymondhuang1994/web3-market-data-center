'use client';
/* oxlint-disable next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
import { AnalysisSummary } from '@/components/analysis-summary';
import { EditionStamp } from '@/components/edition-stamp';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  type Bundle,
  type Dataset,
  colors,
  format,
  label,
  rank,
  series,
  getDataset,
} from '@/lib/data';
import {
  reportSections,
  reportDataset,
  reportWindow,
  reportManifest,
  detailColumns,
  tableColumns,
  tableGroups,
  constantColumns,
  tableHeading,
} from '@/lib/report';
import {
  unitLabel,
  sourceTime,
  sourcePolicy,
  freshness,
  schedule,
  collectionState,
} from '@/lib/quality';
function ReportChart({ dataset, uid }: { dataset: Dataset; uid: string }) {
  const data = series(dataset, 10000);
  if (!data.rows.length || !data.keys.length)
    return <p className="report-empty">本报告窗口内无可用时序。</p>;
  return (
    <>
      <div className="report-legend">
        {data.keys.map((k, i) => (
          <span key={k}>
            <i style={{ background: colors[i % colors.length] }} />
            {label(k)}
          </span>
        ))}
      </div>
      <AreaChart
        width={460}
        height={208}
        data={data.rows}
        margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
        id={uid}
      >
        <CartesianGrid stroke="#e5eaf2" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(s) => String(s).slice(5)}
          minTickGap={45}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          width={68}
          tickFormatter={(n) => format(n, dataset.unit)}
          tick={{ fontSize: 11 }}
        />
        {data.keys.map((key, i) => (
          <Area
            key={key}
            type="linear"
            dataKey={key}
            stroke={colors[i % colors.length]}
            fill={colors[i % colors.length]}
            fillOpacity={0.025}
            strokeWidth={1.7}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
      <p className="report-chart-note">
        {dataset.measures.includes('ALL')
          ? '样本合计'
          : '展示最新有效日主要 5 项'}{' '}
        · {String(data.rows[0].date)} 至 {String(data.rows.at(-1)?.date)}
      </p>
    </>
  );
}
function MiniTable({ d }: { d: Dataset }) {
  const columns = tableColumns(d);
  return (
    <>
      <p className="report-chart-note">
        正文预览前 5 条；关键字段的全部已采集记录见附录。
      </p>
      <div className="report-mini">
        <table>
          <thead>
            <tr>
              {columns.slice(0, 4).map((k) => (
                <th key={k}>{tableHeading(d, k, label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.slice(0, 5).map((r, i) => (
              <tr key={i}>
                {columns.slice(0, 4).map((k) => (
                  <td key={k}>{format(r[k], '', false)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function ReportRanks({ d }: { d: Dataset }) {
  const items = rank(d).slice(0, 10),
    top = items[0]?.value || 1;
  return (
    <div className="report-ranks">
      {items.map((x, i) => (
        <div key={x.name}>
          <span>
            {i + 1}. {label(x.name)}
          </span>
          <i style={{ width: Math.max(1, (x.value / top) * 42) + '%' }} />
          <b>{format(x.value, d.unit)}</b>
        </div>
      ))}
      <p className="report-chart-note">
        最新有效日 Top 10；完整覆盖见数据核验清单。
      </p>
    </div>
  );
}
export function ReportDocument({ bundle }: { bundle: Bundle }) {
  const [ready, setReady] = useState(false);
  const sections = reportSections(),
    manifest = reportManifest(bundle);
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (active) setReady(true);
        }),
      ),
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <div
      className="report-document"
      data-report-ready={ready ? 'true' : 'false'}
      data-snapshot-id={bundle.snapshotId}
    >
      <div className="report-toolbar">
        <a href="/">← 数据中心</a>
        <a
          href={'/api/reports/latest?download=1&snapshot=' + bundle.snapshotId}
        >
          下载本版 PDF
        </a>
        <button onClick={() => window.print()}>打印 / 保存此报告</button>
        <a href="/sources">逐项数据核验</a>
      </div>
      <section className="report-cover">
        <div className="eyebrow">WEB3 MARKET DATA CENTER</div>
        <h1>Web3 市场数据报告</h1>
        <p className="report-cover-sub">CEX · DEX · 代币化股票 · Hyperliquid</p>
        <div className="report-cover-date">
          数据批次 {sourceTime(bundle.generatedAt)}
        </div>
        <EditionStamp bundle={bundle} report />
        <div className="report-cover-grid">
          <div>
            <strong>{manifest.routes}</strong>
            <span>原有页面</span>
          </div>
          <div>
            <strong>{manifest.sections - 1}</strong>
            <span>专题子标签</span>
          </div>
          <div>
            <strong>{bundle.datasets.length}</strong>
            <span>源数据集</span>
          </div>
          <div>
            <strong>
              {bundle.datasets.filter((d) => d.rows.length).length}
            </strong>
            <span>有记录的数据集</span>
          </div>
        </div>
        <p>
          日频图表使用批次日期之前 90 个日历日，月频使用最近约 24
          个月。当前快照保持原始时点，不扩展成历史。
        </p>
        <p>
          全部章节固定同一批数据。最新一日是否完整及来源日界线仍按各项核验状态说明；不将来源缓存刷新时间当作数据日期。
        </p>
        <p>
          待接入内容和全部 28
          个板块目录集中列于附录。关键明细表的全部已采集行和字段分组进入附录；本报告不穷举历史时序的每个筛选组合。
        </p>
        <p className="report-note">
          AI 解读由{' '}
          {bundle.analysis?.producer === 'BigModel'
            ? '智谱 GLM-4.7-Flash'
            : bundle.analysis?.producer || '已配置模型'}{' '}
          基于本报告数据生成，具体证据和限制随解读列示。原站聚合数据的公开使用条件仍待逐项确认。
        </p>
        <p>{schedule.text}；实际采样时间见附录。</p>
      </section>
      {bundle.analysis && (
        <section className="report-analysis-page">
          <AnalysisSummary bundle={bundle} report />
        </section>
      )}
      <section className="report-index">
        <h2>报告目录</h2>
        <div>
          {sections.map((s, i) => (
            <a href={'#section-' + i} key={i}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              {s.title} / {s.view}
            </a>
          ))}
          <a href="#report-details">
            <b>A</b>关键明细
          </a>
          <a href="#report-sources">
            <b>B</b>逐项数据来源与可靠性
          </a>
          <a href="#report-gaps">
            <b>C</b>待接入与板块覆盖
          </a>
        </div>
      </section>
      {sections.map((s, index) => (
        <section
          className="report-section"
          id={'section-' + index}
          key={index}
          data-report-section={s.path + '#' + s.view}
        >
          <div className="report-section-heading">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>{s.title}</h2>
              <p>{s.view}</p>
            </div>
          </div>
          {index === 0 && (
            <div className="report-kpis">
              {[
                ['cex_spot_daily', '样本现货成交额', 'ALL'],
                ['cex_futures_daily', '样本合约成交额', 'ALL'],
                ['futures_oi_btc', 'BTC 聚合持仓', 'value'],
                ['stablecoin_marketcap', '稳定币总市值', 'all_stablecoins'],
              ].map(([id, title, key]) => {
                const d = reportWindow(getDataset(bundle, id), bundle);
                const r = d.rows.at(-1);
                return (
                  <div key={id}>
                    <span>{title}</span>
                    <strong>{format(r?.[key], d.unit)}</strong>
                    <small>{String(r?.date || '暂缺')}</small>
                  </div>
                );
              })}
            </div>
          )}
          <div className="report-panels">
            {s.panels.map((def, i) => {
              const raw = reportDataset(bundle, def, s.view),
                d = reportWindow(raw, bundle);
              const f = freshness(raw, Date.parse(bundle.generatedAt));
              return (
                <article
                  className="report-card"
                  key={i}
                  data-report-panel={def.id}
                >
                  <div className="report-card-heading">
                    <h3>{def.title}</h3>
                    <span>{f.text}</span>
                  </div>
                  <p className="report-unit">
                    {unitLabel(raw.unit)} · {raw.grain}
                  </p>
                  {!raw.rows.length ? (
                    <div className="report-empty">
                      <b>待接入 / 数据暂缺</b>
                      <p>{def.note || raw.note}</p>
                    </div>
                  ) : def.mode === 'table' ? (
                    <MiniTable d={raw} />
                  ) : def.mode === 'rank' || !d.rows.some((r) => r.date) ? (
                    <ReportRanks d={d} />
                  ) : (
                    <ReportChart dataset={d} uid={`report-${index}-${i}`} />
                  )}
                  <div className="report-card-source">
                    <span>数据截至 {sourceTime(raw.asOf)}</span>
                    <span>{sourcePolicy(raw).reliability}</span>
                    <a href={raw.source.url}>{raw.source.name} ↗</a>
                  </div>
                  {raw.unit === '%' || raw.unit === 'ratio' ? (
                    <p className="report-note">{raw.note}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <section className="report-appendix" id="report-details">
        <h2>A · 关键明细</h2>
        <p>
          保留以下表格全部已采集行。列名注明单位；源单位未核的数字不自动换算或年化。来源未返回的记录不补零。
        </p>
        {Object.keys(detailColumns).flatMap((id) => {
          const d = getDataset(bundle, id);
          return tableGroups(d).map((cols, groupIndex) => (
            <div
              className="report-detail-block"
              key={id + '-' + groupIndex}
              data-detail-dataset={id}
              data-row-count={d.rows.length}
            >
              <h3>
                {d.title} · 字段组 {groupIndex + 1}/{tableGroups(d).length} ·{' '}
                {d.rows.length} 条
              </h3>
              <p className="report-chart-note">
                数据截至 {sourceTime(d.asOf)} ·
                同一记录编号在各字段组对应同一行。{sourcePolicy(d).reliability}
              </p>
              <p className="report-constants">
                本组全部记录相同的字段：
                {constantColumns(d)
                  .map(
                    (k) =>
                      tableHeading(d, k, label) +
                      ' = ' +
                      format(d.rows[0]?.[k], '', false),
                  )
                  .join('；') || '无'}
                。
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    {cols.map((k) => (
                      <th key={k}>{tableHeading(d, k, label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      {cols.map((k) => (
                        <td key={k}>{format(r[k], '', false)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ));
        })}
      </section>
      <section
        className="report-appendix report-source-list"
        id="report-sources"
      >
        <h2>B · 逐项数据来源与可靠性</h2>
        <p>
          全部按{schedule.text}
          检查，未启用项除外。可靠性结论不等同于来源再发布许可。
        </p>
        {bundle.datasets.map((d) => (
          <article key={d.id}>
            <h3>{d.title}</h3>
            <p>
              {sourcePolicy(d).reliability} ·{' '}
              {freshness(d, Date.parse(bundle.generatedAt)).text} ·{' '}
              {collectionState(d)}
            </p>
            <p>
              实际获取：{d.rows.length ? sourceTime(d.fetchedAt) : '无有效数据'}
              ；最近尝试：{sourceTime(d.collection?.attemptedAt)}；数据截至：
              {sourceTime(d.asOf)}
            </p>
            <p>
              粒度：{d.grain}；单位：{unitLabel(d.unit)}；{d.rows.length} 行；
              {sourcePolicy(d).history}
            </p>
            <p>{d.note}</p>
            <a href={d.source.url}>
              {d.source.name} · {d.source.url}
            </a>
          </article>
        ))}
      </section>
      <section className="report-appendix" id="report-gaps">
        <h2>C · 待接入与板块覆盖</h2>
        <p>
          待接入项全部保留，后续由负责人决定保留或调整。重复空态在本清单集中说明。
        </p>
        <table>
          <thead>
            <tr>
              <th>栏目</th>
              <th>状态与原因</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(
              new Map(
                sections.flatMap((s) =>
                  s.panels.map((p) => [p.id, p] as const),
                ),
              ).values(),
            ).map((p) => {
              const d = getDataset(bundle, p.id);
              return !d.rows.length ? (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.note || d.note}</td>
                </tr>
              ) : null;
            })}
            <tr>
              <td>AI 市场解读</td>
              <td>
                {bundle.analysis
                  ? '本报告已包含同快照 AI 解读'
                  : '等待本日报 AI 解读'}
              </td>
            </tr>
            {getDataset(bundle, 'tradfi_labels').rows.map((r) => (
              <tr key={String(r.entity)}>
                <td>{String(r.entity)}</td>
                <td>
                  {getDataset(bundle, r.entity === 'Stocks' ? 'tradfi_stocks' : 'sector_'+r.entity).rows.length
                    ? '已取得历史，成交额、持仓、费率分别验收；见对应章节'
                    : '本版历史数据暂缺；目录保留'}{' '}
                  · 来源覆盖 {String(r.pairCount)} 对
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <script
        type="application/json"
        id="report-manifest"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(manifest).replace(/</g, '\\u003c'),
        }}
      />
    </div>
  );
}
