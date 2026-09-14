'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Database,
  ExternalLink,
  Info,
  LayoutGrid,
  LineChart as LineIcon,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bundle,
  Dataset,
  colors,
  format,
  getDataset,
  label,
  latestValue,
  numeric,
  pending,
  rank,
  series,
  statusText,
} from '@/lib/data';
import { groups, pages, PanelDef } from '@/lib/catalog';
const github = 'https://github.com/raymondhuang1994/web3-market-data-center';
function Pick({
  value,
  onChange,
  options,
  label: aria,
}: {
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(String(v))}
      items={options}
    >
      <SelectTrigger size="sm" aria-label={aria}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((x) => (
          <SelectItem value={x.value} key={x.value}>
            {x.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Chart({
  dataset,
  days = 90,
  selected = 'all',
  measure = 'value',
  compact = false,
}: {
  dataset: Dataset;
  days?: number;
  selected?: string;
  measure?: string;
  compact?: boolean;
}) {
  const { rows, keys } = useMemo(
    () => series(dataset, days, measure, selected),
    [dataset, days, selected, measure],
  );
  if (!rows.length || !keys.length)
    return (
      <Empty
        title="当前筛选下暂无时间序列"
        note="可切换明细表查看已有快照，或选择其他标的。"
      />
    );
  const config = Object.fromEntries(
    keys.map((key, i) => [
      key,
      { label: label(key), color: colors[i % colors.length] },
    ]),
  );
  return (
    <>
      <div className="legend">
        {keys.map((key, i) => (
          <span className="legend-item" key={key}>
            <i
              className="legend-dot"
              style={{ background: colors[i % colors.length] }}
            />
            {label(key)}
          </span>
        ))}
      </div>
      <ChartContainer
        config={config}
        className={`chart-box ${compact ? 'compact' : ''}`}
        style={{ aspectRatio: 'auto' }}
      >
        <AreaChart
          data={rows}
          margin={{ top: 10, right: 3, left: -14, bottom: 0 }}
        >
          <defs>
            {keys.map((key, i) => (
              <linearGradient
                key={key}
                id={`grad-${dataset.id}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={colors[i % colors.length]}
                  stopOpacity={0.18}
                />
                <stop
                  offset="100%"
                  stopColor={colors[i % colors.length]}
                  stopOpacity={0.01}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            stroke="#eef1f6"
            vertical={false}
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={38}
            tick={{ fill: '#98a5b8', fontSize: 10 }}
            tickFormatter={(v) => String(v).slice(5)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={65}
            tick={{ fill: '#98a5b8', fontSize: 10 }}
            tickFormatter={(v) => format(v)}
          />
          <Tooltip
            content={({ active, payload, label: day }) =>
              active && payload?.length ? (
                <div className="data-tooltip">
                  <strong>
                    {String(day)} · {dataset.unit}
                  </strong>
                  {payload.map((item, i) => (
                    <p key={i}>
                      <span style={{ color: item.color }}>
                        {label(String(item.name))}
                      </span>
                      <b>{format(item.value, dataset.unit)}</b>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          {keys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              fill={`url(#grad-${dataset.id}-${i})`}
              strokeWidth={1.8}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </>
  );
}
function Empty({
  title = '待接入 / 数据暂缺',
  note,
}: {
  title?: string;
  note?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Database size={22} />
      </div>
      <h3>{title}</h3>
      <p>{note || '栏目已保留，等待确认可持续使用的免费数据源。'}</p>
    </div>
  );
}
function Rankings({
  dataset,
  measure = 'value',
  count = 6,
}: {
  dataset: Dataset;
  measure?: string;
  count?: number;
}) {
  const items = rank(dataset, measure).slice(0, count);
  const max = items[0]?.value || 1;
  return (
    <div>
      {items.map((x, i) => (
        <div className="rank-row" key={x.name}>
          <span className="rank-number num">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div>
            <div className="rank-entity">
              <span className="entity-avatar" style={{ color: colors[i % 6] }}>
                {x.name.slice(0, 1).toUpperCase()}
              </span>
              {label(x.name)}
            </div>
            <div className="share-track">
              <div
                className="share-fill"
                style={{
                  width: `${Math.max(0, x.value / max) * 100}%`,
                  background: colors[i % 6],
                }}
              />
            </div>
          </div>
          <div className="rank-right num">{format(x.value, dataset.unit)}</div>
        </div>
      ))}
      {!items.length && <Empty />}
    </div>
  );
}
function DataTable({ dataset }: { dataset: Dataset }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({
    key: dataset.rows[0]?.date ? 'date' : dataset.measures[0] || 'entity',
    desc: true,
  });
  const columns = useMemo(() => {
    if (!dataset.rows.length) return [];
    const all = Array.from(
      new Set(dataset.rows.flatMap((r) => Object.keys(r))),
    );
    const preferred = [
      'date',
      'entity',
      'quote_symbol',
      'dex',
      'referencePrice',
      'referenceAsOf',
      'referenceStale',
      'buyExchange',
      'sellExchange',
      'buyIntervalHours',
      'sellIntervalHours',
      ...dataset.measures.filter((k) => k !== 'value'),
      'value',
    ];
    return Array.from(new Set([...preferred, ...all])).filter((k) =>
      all.includes(k),
    );
  }, [dataset]);
  const filtered = useMemo(
    () =>
      dataset.rows
        .filter(
          (r) =>
            !query ||
            Object.values(r).some((v) =>
              String(v).toLowerCase().includes(query.toLowerCase()),
            ),
        )
        .sort((a, b) => {
          const av = a[sort.key],
            bv = b[sort.key];
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const diff =
            numeric(av) && numeric(bv)
              ? av - bv
              : String(av).localeCompare(String(bv));
          return sort.desc ? -diff : diff;
        }),
    [dataset, query, sort],
  );
  return (
    <>
      <div className="panel-controls">
        <div className="control-group">
          <Search size={14} color="#93a1b7" />
          <input
            className="small-search"
            placeholder="搜索标的、交易所或日期"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            aria-label="搜索明细"
          />
        </div>
        <span className="control-label">
          {filtered.length} 条记录 · 点击列头排序
        </span>
      </div>
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            {columns.map((k) => (
              <TableHead
                key={k}
                aria-sort={
                  sort.key === k
                    ? sort.desc
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button
                  onClick={() => {
                    setSort({
                      key: k,
                      desc: sort.key === k ? !sort.desc : true,
                    });
                    setPage(0);
                  }}
                >
                  {label(k)} {sort.key === k ? (sort.desc ? '↓' : '↑') : ''}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.slice(page * 10, (page + 1) * 10).map((r, i) => (
            <TableRow key={i}>
              {columns.map((k) => (
                <TableCell className={numeric(r[k]) ? 'num' : ''} key={k}>
                  {typeof r[k] === 'boolean'
                    ? r[k]
                      ? '是'
                      : '否'
                    : format(r[k], '', false)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="table-pager">
        <span>
          第 {Math.min(page * 10 + 1, filtered.length)}—
          {Math.min((page + 1) * 10, filtered.length)} 条 / 共 {filtered.length}{' '}
          条
        </span>
        <span>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <button
            disabled={(page + 1) * 10 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </span>
      </div>
    </>
  );
}
function Panel({
  def,
  dataset,
  compact = false,
}: {
  def: PanelDef;
  dataset: Dataset;
  compact?: boolean;
}) {
  const [days, setDays] = useState(90);
  const [view, setView] = useState(def.mode || 'chart');
  const [selected, setSelected] = useState('all');
  const [measure, setMeasure] = useState(def.measure || 'value');
  const measureChoices = dataset.rows.some((r) => r.entity)
    ? dataset.measures.filter(
        (k) => k !== 'value' && dataset.rows.some((r) => numeric(r[k])),
      )
    : [];
  const selectedUnit = ['wallets', 'unique_traders'].includes(measure)
    ? 'addresses'
    : [
          'trades',
          'transactions',
          'tokens_launched',
          'active_markets',
          'asset_count',
        ].includes(measure)
      ? 'count'
      : measure === 'funding_hourly'
        ? 'decimal per hour'
        : dataset.unit;
  const chartDataset = { ...dataset, unit: selectedUnit };
  const available = rank(dataset, measure).map((x) => ({
    value: x.name,
    label: label(x.name),
  }));
  const noData = !dataset.rows.length;
  return (
    <section className={`panel ${def.full ? 'full-panel' : ''}`}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{def.title}</h2>
          <div className="panel-subtitle">
            {def.subtitle ||
              `${dataset.unit || '数据源待接入'}${dataset.grain ? ' · ' + dataset.grain : ''}`}
          </div>
        </div>
        <div className="panel-header-right">
          <span className={`status-badge ${dataset.status}`}>
            {statusText(dataset)}
          </span>
        </div>
      </div>
      {noData ? (
        <Empty
          note={
            def.note ||
            (['dex_spot_market_share', 'dex_perp_market_share'].includes(
              dataset.id,
            )
              ? '栏目已保留。免费数据源的公开使用条件尚未满足；确认可用来源后接入，现货与永续分别计算份额。'
              : dataset.id === 'hl_fees_daily'
                ? '栏目已保留。当前费用来源的公开使用条件待确认，暂不展示数值。'
                : dataset.note)
          }
        />
      ) : (
        <div className="panel-body">
          {!compact && (
            <div className="panel-controls">
              <div className="control-group">
                {view !== 'table' && measureChoices.length > 1 && (
                  <Pick
                    label="选择指标"
                    value={measure}
                    onChange={setMeasure}
                    options={[
                      { value: 'value', label: '默认指标' },
                      ...measureChoices.map((k) => ({
                        value: k,
                        label: label(k),
                      })),
                    ]}
                  />
                )}
                {view === 'chart' && available.length > 1 && (
                  <Pick
                    label="选择交易所或类别"
                    value={selected}
                    onChange={setSelected}
                    options={[
                      {
                        value: 'all',
                        label: dataset.measures.includes('ALL')
                          ? '样本合计'
                          : '主要类别',
                      },
                      ...available,
                    ]}
                  />
                )}{' '}
                {view === 'chart' && (
                  <div className="periods">
                    {[30, 90, 180, 1460].map((n) => (
                      <button
                        key={n}
                        className={days === n ? 'active' : ''}
                        onClick={() => setDays(n)}
                      >
                        {n === 1460 ? '全部' : `${n}D`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="view-controls">
                {dataset.rows.some((r) => r.date) && (
                  <button
                    aria-label="趋势图"
                    title="趋势图"
                    className={view === 'chart' ? 'active' : ''}
                    onClick={() => setView('chart')}
                  >
                    <LineIcon size={16} />
                  </button>
                )}
                <button
                  aria-label="排名"
                  title="最新排名"
                  className={view === 'rank' ? 'active' : ''}
                  onClick={() => setView('rank')}
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  aria-label="明细表"
                  title="明细表"
                  className={view === 'table' ? 'active' : ''}
                  onClick={() => setView('table')}
                >
                  <Table2 size={16} />
                </button>
              </div>
            </div>
          )}
          {dataset.status === 'review' && (
            <div className="note-bar">
              <Info size={14} />
              <span>
                口径待核：保留来源数值，单位为「{dataset.unit}
                」，不作未经验证的换算。
              </span>
            </div>
          )}
          {view === 'table' ? (
            <DataTable dataset={dataset} />
          ) : view === 'rank' ? (
            <Rankings
              dataset={chartDataset}
              measure={measure}
              count={compact ? 5 : 10}
            />
          ) : (
            <Chart
              dataset={chartDataset}
              days={days}
              selected={selected}
              measure={measure}
              compact={compact}
            />
          )}
        </div>
      )}
      <div className="panel-bottom">
        <a
          className="source-link"
          href={dataset.source.url}
          target="_blank"
          rel="noreferrer"
        >
          来源：{dataset.source.name}
          <ExternalLink size={10} />
        </a>
        <span>数据截至 {dataset.asOf?.slice(0, 10) || '待确认'}</span>
      </div>
      {!compact && (
        <details className="source-details">
          <summary>数据口径与覆盖范围</summary>
          <p>{def.note || dataset.note || '以来源公布口径为准。'}</p>
          <p>
            最近采集：
            {dataset.fetchedAt
              ? new Date(dataset.fetchedAt).toLocaleString('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                  hour12: false,
                })
              : '尚未接入'}
            （北京时间）。采集时间与数据日期分别记录。
          </p>
        </details>
      )}
    </section>
  );
}
function Kpi({
  dataset,
  title,
  metric = 'ALL',
  href,
  icon: Icon = Activity,
}: {
  dataset: Dataset;
  title: string;
  metric?: string;
  href: string;
  icon?: typeof Activity;
}) {
  const value = latestValue(dataset, metric);
  const rows = dataset.rows;
  const last = rows.at(-1),
    prev = rows.at(-2);
  const a = last?.[metric] ?? last?.value,
    b = prev?.[metric] ?? prev?.value;
  const pct =
    numeric(a) && numeric(b) && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
  return (
    <Link className="kpi" href={href}>
      <div className="kpi-top">
        {title}
        <Icon size={17} />
      </div>
      <div className="kpi-value num">{format(value, dataset.unit)}</div>
      <div className="kpi-meta">
        {pct !== null && (
          <span className={`change ${pct >= 0 ? 'positive' : 'negative'}`}>
            {pct >= 0 ? '↗' : '↘'} {Math.abs(pct).toFixed(2)}%
          </span>
        )}
        <span>
          {pct !== null ? '较前一数据日 · ' : ''}
          {dataset.asOf?.slice(5, 10) || '待接入'}
        </span>
      </div>
    </Link>
  );
}
export default function Dashboard() {
  const pathname = usePathname();
  const page = pages.find((x) => x.path === pathname);
  const group = page?.group || 'overview';
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [sector, setSector] = useState('Stocks');
  const [showSources, setShowSources] = useState(false);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/data', { cache: 'no-store' });
      if (!response.ok) throw Error('refresh');
      setBundle(await response.json());
    } catch {
      setError('更新检查暂不可用，继续显示最近一次成功加载的数据。');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/data', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error('load');
        return r.json();
      })
      .then((data) => {
        setBundle(data as Bundle);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('数据加载暂不可用，请点击刷新重试。');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);
  const get = (id: string) =>
    bundle ? getDataset(bundle, id) : pending(id, id);
  const currentView = page?.views[tab] || page?.views[0];
  let definitions = currentView?.panels || [];
  if (page?.path === '/tokenized-stocks/sectors' && sector !== 'Stocks')
    definitions = [
      {
        id: `sector_${sector}`,
        title: `${sector} 板块数据`,
        full: true,
        note: '该板块已保留在原站 28 类目录中，历史数据尚未完成接入；当前可在目录查看交易对覆盖数量。',
      },
    ];
  const datasetFor = (def: PanelDef) => {
    const d = get(def.id);
    if (def.id === 'stablecoin_marketcap') {
      const measures = d.measures.filter((k) =>
        tab === 1 ? !k.startsWith('all_') : k.startsWith('all_'),
      );
      return { ...d, measures };
    }
    return d;
  };
  return (
    <>
      <header className="site-header">
        <Link href="/" className="wordmark">
          <span className="wordmark-icon">
            <BarChart3 size={22} />
          </span>
          <strong>Web3 数据中心</strong>
        </Link>
        <nav className="top-nav" aria-label="主要导航">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={g.path}
              className={group === g.id ? 'active' : ''}
            >
              {g.name}
            </Link>
          ))}
        </nav>
        <div className="header-end">
          <span className="live-dot" />
          <span className="last-check">每日更新</span>
          <span className="lang-tag">中文</span>
        </div>
      </header>
      <main className="shell">
        {page && group !== 'hl' && (
          <nav className="subnav" aria-label="板块导航">
            {pages
              .filter((p) => p.group === group)
              .map((p) => (
                <Link
                  key={p.path}
                  href={p.path}
                  className={p.path === pathname ? 'active' : ''}
                >
                  {p.title}
                </Link>
              ))}
          </nav>
        )}
        <div className="breadcrumb">
          <LayoutGrid size={12} />
          <Link href="/">数据中心</Link>
          <ChevronRight size={12} />
          {page?.title || '市场总览'}
        </div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {page
                ? `${group.toUpperCase()} · MARKET INTELLIGENCE`
                : 'MARKET INTELLIGENCE'}
            </div>
            <h1>{page?.title || '市场总览'}</h1>
            <p>
              {page?.description ||
                '聚焦交易、资金与市场结构，让关键变化一目了然。'}
            </p>
          </div>
          <div className="heading-tools">
            <span className="soft-button date-label">
              <CalendarDays size={14} />
              {bundle?.generatedAt.slice(0, 10) || '加载中'}
            </span>
            <button
              className="soft-button"
              onClick={refresh}
              disabled={loading}
              title="检查最新已发布数据"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span className="date-label">刷新</span>
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="note-bar">
            <Info size={14} />
            {error}
          </div>
        )}
        <div className="summary-strip">
          <div className="summary-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h2>
              AI 市场解读 <span className="summary-status">待接入</span>
            </h2>
            <p>
              保留每日解读栏目。数据来源和生成方案确认后，将基于可核验指标生成摘要。
            </p>
          </div>
          <button
            className="soft-button"
            onClick={() => setShowSources(!showSources)}
          >
            查看数据覆盖
            <ChevronRight size={13} />
          </button>
        </div>
        {!bundle ? (
          <div className="kpi-grid">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} style={{ height: 145, borderRadius: 12 }} />
            ))}
          </div>
        ) : page ? (
          <>
            {page.path === '/tokenized-stocks/sectors' && (
              <div className="note-bar">
                <Info size={15} />
                <span>
                  28 个原站板块完整保留。Stocks
                  已接入历史；产品可能包含股票永续合约，不统一标为有股票兑付权的代币。
                </span>
                <Pick
                  label="选择热门板块"
                  value={sector}
                  onChange={setSector}
                  options={get('tradfi_labels').rows.map((r) => ({
                    value: String(r.entity),
                    label: `${String(r.entity)} · ${r.pairCount} 对`,
                  }))}
                />
              </div>
            )}
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(Number(v))}
              className="sub-tabs"
            >
              <TabsList>
                {page.views.map((v, i) => (
                  <TabsTrigger key={v.name} value={i}>
                    {v.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="group-panels">
              {definitions.map((def) => (
                <Panel
                  key={`${pathname}-${tab}-${sector}-${def.id}`}
                  def={def}
                  dataset={datasetFor(def)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="kpi-grid">
              <Kpi
                dataset={get('cex_spot_daily')}
                title="样本现货日成交额"
                href="/cex/volume"
                icon={BarChart3}
              />
              <Kpi
                dataset={get('cex_futures_daily')}
                title="样本合约日成交额"
                href="/cex/volume"
                icon={TrendingUp}
              />
              <Kpi
                dataset={get('futures_oi_btc')}
                title="BTC 聚合持仓量"
                href="/cex/open-interest"
                icon={Activity}
              />
              <Kpi
                dataset={get('stablecoin_marketcap')}
                metric="all_stablecoins"
                title="稳定币总市值"
                href="/tokenized-stocks/stablecoins"
                icon={Wallet}
              />
            </div>
            <h2 className="section-label">
              <BarChart3 size={17} />
              交易市场<span>Trading markets</span>
              <Link href="/cex/volume">
                查看全部
                <ArrowUpRight size={14} />
              </Link>
            </h2>
            <div className="overview-grid">
              <Panel
                def={{
                  id: 'cex_spot_daily',
                  title: '现货成交额趋势',
                  subtitle: '样本合计 · USD · 最近 90 个数据日',
                }}
                dataset={get('cex_spot_daily')}
                compact
              />
              <Panel
                def={{
                  id: 'cex_futures_daily',
                  title: '合约交易所排名',
                  subtitle: '最新完整日 · Top 5',
                  mode: 'rank',
                }}
                dataset={get('cex_futures_daily')}
                compact
              />
            </div>
            <h2 className="section-label">
              <Activity size={17} />
              资金与新兴市场<span>Capital & emerging markets</span>
            </h2>
            <div className="overview-lower">
              <Panel
                def={{
                  id: 'futures_oi_btc',
                  title: 'BTC 未平仓合约',
                  subtitle: '聚合 OI · USD',
                }}
                dataset={get('futures_oi_btc')}
                compact
              />
              <Panel
                def={{
                  id: 'tradfi_stocks',
                  title: '股票板块成交额',
                  subtitle: '来源股票标签 · 含永续合约',
                }}
                dataset={get('tradfi_stocks')}
                compact
              />
            </div>
            <div className="overview-lower">
              <Panel
                def={{
                  id: 'hl_hip3_and_crypto',
                  title: 'Hyperliquid · 市场结构',
                  subtitle: 'Crypto 与 HIP-3 · 日成交额',
                }}
                dataset={get('hl_hip3_and_crypto')}
                compact
              />
              <Panel
                def={{
                  id: 'dex_spot_market_share',
                  title: 'DEX 市场份额',
                  subtitle: '现货 / 永续分别统计',
                }}
                dataset={get('dex_spot_market_share')}
                compact
              />
            </div>
            <div className="note-bar">
              <Info size={14} />
              <span>
                CEX 源样本包含 Hyperliquid、Uniswap
                等非中心化平台；页面沿用可比样本，并明确标注，不能将样本合计解释为全球
                CEX 总量。
              </span>
            </div>
          </>
        )}
        {showSources && bundle && (
          <section className="panel" id="data-coverage">
            <div className="panel-header">
              <h2 className="panel-title">数据覆盖与更新状态</h2>
              <button
                className="soft-button"
                onClick={() => setShowSources(false)}
              >
                收起
              </button>
            </div>
            <div className="panel-body">
              <div className="coverage-grid">
                {(['ready', 'stale', 'review', 'pending'] as const).map(
                  (status) => (
                    <div className="coverage-item" key={status}>
                      <strong className="num">
                        {
                          bundle.datasets.filter((d) => d.status === status)
                            .length
                        }
                      </strong>
                      <span>
                        {
                          {
                            ready: '已接入',
                            stale: '源数据延迟',
                            review: '口径待核',
                            pending: '待接入',
                          }[status]
                        }
                        数据集
                      </span>
                    </div>
                  ),
                )}
              </div>
              <p className="control-label">
                采集批次：
                {new Date(bundle.generatedAt).toLocaleString('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                  hour12: false,
                })}{' '}
                ·{' '}
                {bundle.delivery === 'live' ? '日更发布快照' : '初始已验证快照'}
                。这是数据集状态，不能视为全部指标实现比例。具体日期见每张图表。
              </p>
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>数据集</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>数据截至</TableHead>
                    <TableHead>来源</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.datasets.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.title}</TableCell>
                      <TableCell>{statusText(d)}</TableCell>
                      <TableCell>{d.asOf?.slice(0, 10) || '—'}</TableCell>
                      <TableCell>
                        <a href={d.source.url} target="_blank" rel="noreferrer">
                          {d.source.name} ↗
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
        <footer className="dashboard-footer">
          <div>
            Web3 数据中心{' '}
            <span style={{ margin: '0 9px', opacity: 0.5 }}>|</span> 每日采集 ·
            以各来源最新公布数据为准
          </div>
          <div className="footer-links">
            <button
              onClick={() => {
                setShowSources(true);
                setTimeout(
                  () =>
                    document
                      .getElementById('data-coverage')
                      ?.scrollIntoView({ behavior: 'smooth' }),
                  50,
                );
              }}
            >
              数据来源与口径
            </button>
            <a href={github} target="_blank" rel="noreferrer">
              GitHub 项目 ↗
            </a>
            <a
              href="https://data.wublock123.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              参考原站 ↗
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
