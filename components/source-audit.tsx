'use client';
/* oxlint-disable next/no-html-link-for-pages */
import { useState } from 'react';
import { EditionStamp } from '@/components/edition-stamp';
import type { Bundle } from '@/lib/data';
import { getDataset } from '@/lib/data';
import { pages } from '@/lib/catalog';
import {
  metaText,
  unitLabel,
  dataChecks,
  sourcePolicy,
  freshness,
  sourceTime,
  collectionState,
  schedule,
  batchHealth,
  coverage,
  dependencyIds,
} from '@/lib/quality';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
export function SourceAudit({ bundle }: { bundle: Bundle }) {
  const [query, setQuery] = useState('');
  const health = batchHealth(bundle);
  const configured = new Set(bundle.datasets.map((d) => d.id));
  const gaps = [
    ...new Map(
      pages.flatMap((p) =>
        p.views.flatMap((v) =>
          v.panels.map(
            (panel) =>
              [panel.id, { ...panel, path: p.path, view: v.name }] as const,
          ),
        ),
      ),
    ).values(),
  ].filter(
    (p) =>
      !configured.has(p.id) && dependencyIds(p.id).every((id) => id === p.id),
  );
  const sectors = getDataset(bundle, 'tradfi_labels').rows.filter(
    (r) => r.entity !== 'Stocks',
  );
  const missingSectors = sectors.filter(r => !getDataset(bundle, 'sector_'+r.entity).rows.length);
  return (
    <>
      <EditionStamp bundle={bundle} />
      <div className="audit-intro">
        <p>
          <strong>采集计划：</strong>
          {schedule.text}
          。调度可能延迟，以下记录实际采集时间；来源不更新时保留旧值。
        </p>
        <p>
          <strong>最近发布：</strong>
          {sourceTime(bundle.edition?.publishedAt || bundle.generatedAt)} ·{' '}
          {health.text}
          。技术接入、数据时效和口径可靠性分别判断。
        </p>
        <p>
          {bundle.datasets.length} 个源数据集 ·{' '}
          {bundle.datasets.filter((d) => d.rows.length).length} 个有记录 ·{' '}
          {gaps.length} 个额外待接入组件 · {missingSectors.length}{' '}
          个仅有目录的板块。此处不将“有记录”当作可对外引用的完成率。
        </p>
      </div>
      <div className="audit-filter">
        <label htmlFor="audit-search">查找数据</label>
        <input
          id="audit-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="指标、来源或数据编号"
        />
      </div>
      <div className="audit-list">
        {bundle.datasets
          .filter((d) =>
            `${d.title} ${d.id} ${d.source.name}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((d) => {
            const p = sourcePolicy(d),
              f = freshness(d),
              c = coverage(d);
            const verification = c.officialVerification as { reason?:string; through?:string; relativeDifferencePct?:number } | undefined;
            return (
              <section className="audit-item" id={d.id} key={d.id}>
                <div className="audit-item-title">
                  <h2>{d.title}</h2>
                  <span
                    className={`status-badge ${f.key === 'delayed' ? 'stale' : !d.rows.length ? 'pending' : 'review'}`}
                  >
                    {f.text}
                  </span>
                </div>
                <div className="audit-facts">
                  <div>
                    <span>直接获取来源</span>
                    <a href={d.source.url} target="_blank" rel="noreferrer">
                      {d.source.name} ↗
                    </a>
                    <small>{p.sourceLevel}</small>
                  </div>
                  <div>
                    <span>实际采集成功时间</span>
                    <strong>
                      {d.rows.length ? sourceTime(d.fetchedAt) : '尚无有效数据'}
                    </strong>
                    <small>{collectionState(d)}</small>
                  </div>
                  <div>
                    <span>最近尝试时间</span>
                    <strong>{sourceTime(d.collection?.attemptedAt)}</strong>
                    <small>{schedule.text}</small>
                  </div>
                  <div>
                    <span>数据实际截至</span>
                    <strong>{sourceTime(d.asOf)}</strong>
                    <small>
                      源刷新：
                      {sourceTime(
                        metaText(c.sourceUpdatedAt, c.sourceExecutionEndedAt) ||
                          null,
                      )}
                    </small>
                  </div>
                  <div>
                    <span>粒度 / 单位</span>
                    <strong>
                      {d.grain} / {unitLabel(d.unit) || '未确认'}
                    </strong>
                    <small>{p.publication}</small>
                  </div>
                  <div>
                    <span>可靠性结论</span>
                    <strong>{p.reliability}</strong>
                    <small>{p.useStatus}</small>
                  </div>
                </div>
                <p className="audit-note">{p.basis || d.note}</p>
                {verification && <p className="audit-note">官方复核：{verification.reason} 档案截至 {verification.through || '未提供'}。
                  {typeof verification.relativeDifferencePct === 'number' && `同日不同采样时点的数值差 ${verification.relativeDifferencePct.toFixed(3)}%，不视为一致性认证。`}
                </p>}
                {d.collection?.error && (
                  <p className="audit-error">最近失败：{d.collection.error}</p>
                )}
                <details>
                  <summary>查看获取地址、历史范围与核验依据</summary>
                  <p className="audit-url">{d.source.url}</p>
                  <p>
                    {p.history} · 已保存 {d.rows.length} 行
                    {p.truncated
                      ? ' · 来源历史或实体已截取，未声称全量覆盖'
                      : ''}
                  </p>
                  <p>
                    本版检查结构、日期、缺值和基础单位；尚未完成独立来源逐点对账。无源时间时不以采集时间冒充数据发生时间。
                  </p>
                  <p>{d.note}</p>
                  <p>
                    存在缺失指标的行：{dataChecks(d).nullRows}；Stocks
                    持仓覆盖未闭合差额：
                    {dataChecks(d).oiCoverageDiscrepancy ?? '不适用'}
                    。缺值不补零。
                  </p>
                  <p>数据编号：{d.id}</p>
                </details>
              </section>
            );
          })}
      </div>
      <section className="panel audit-gaps">
        <h2>派生指标与原始来源依赖</h2>
        <p>
          以下是在已有数据上恢复的原有计算组件，不作为新增源数据集计算接入率。
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>指标</TableHead>
              <TableHead>依赖数据与规则</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ...new Map(
                pages.flatMap((p) =>
                  p.views.flatMap((v) =>
                    v.panels.map((panel) => [panel.id, panel] as const),
                  ),
                ),
              ).values(),
            ]
              .filter(
                (p) =>
                  !configured.has(p.id) &&
                  dependencyIds(p.id).some((id) => id !== p.id),
              )
              .map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>
                    {dependencyIds(p.id)
                      .map((id) => getDataset(bundle, id).title)
                      .join(' + ')}
                    。{getDataset(bundle, p.id).note}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </section>
      <section className="panel audit-gaps">
        <h2>保留并等待决定的栏目</h2>
        <p>
          以下栏目没有自动替换或删除。免费来源、口径或方法无法落实时，等待你决定保留、改用已确认来源或调整范围。
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>栏目</TableHead>
              <TableHead>缺失原因 / 下一步</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundle.datasets
              .filter((d) => !d.rows.length)
              .map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.title}</TableCell>
                  <TableCell>{d.note}</TableCell>
                </TableRow>
              ))}
            {gaps.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <a href={g.path}>{g.title}</a>
                </TableCell>
                <TableCell>{g.note || '方法或数据来源待确认'}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>AI 市场解读</TableCell>
              <TableCell>
                智谱 GLM-4.7-Flash
                免费模型解读；数字由程序计算、引用绑定同一数据快照。密钥仅在服务端保存，未启用付费模型或搜索。
              </TableCell>
            </TableRow>
            {sectors.map((r) => (
              <TableRow key={String(r.entity)}>
                <TableCell>{String(r.entity)}</TableCell>
                <TableCell>
                  {getDataset(bundle, 'sector_'+r.entity).rows.length
                    ? '本版已有成交历史；持仓和费率分别查看上方数据项'
                    : '本版历史暂缺，目录保留'}
                  （来源目录覆盖 {String(r.pairCount)} 对）。
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
