/* oxlint-disable next/no-html-link-for-pages */
// Preserve native navigation until vinext Link prefetch is reliable.
import { SourceAudit } from '@/components/source-audit';
import { readBundle } from '@/lib/bundles';
export default async function SourcesPage() {
  const bundle = await readBundle();
  return (
    <main className="shell audit-page">
      <div className="report-toolbar">
        <a href="/">← 数据中心</a>
        <a href={'/api/reports/latest?download=1' + (bundle?.snapshotId !== 'bootstrap' ? '&snapshot=' + bundle?.snapshotId : '')}>下载整站 PDF</a>
      </div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DATA QUALITY & SOURCES</div>
          <h1>逐项数据核验</h1>
          <p>来源、采集时间、时效与可靠性记录</p>
        </div>
      </div>
      {bundle && <SourceAudit bundle={bundle} />}
    </main>
  );
}
