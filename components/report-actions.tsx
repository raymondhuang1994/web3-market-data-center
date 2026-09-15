'use client';
/* oxlint-disable next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
import { sourceTime } from '@/lib/quality';
export function ReportActions({ snapshotId }: { snapshotId?: string }) {
  const snapshot =
    snapshotId && /^[a-f0-9]{64}$/.test(snapshotId) ? snapshotId : '';
  const reportUrl =
    '/api/reports/latest' + (snapshot ? '?snapshot=' + snapshot : '');
  const [stamp, setStamp] = useState('正在检查报告状态');
  useEffect(() => {
    const c = new AbortController();
    fetch(reportUrl, { signal: c.signal, cache: 'no-store' })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ dataGeneratedAt?: string }>) : null,
      )
      .then((r) =>
        setStamp(
          r?.dataGeneratedAt
            ? 'PDF 数据批次：' + sourceTime(r.dataGeneratedAt)
            : 'PDF 尚未发布，可先打开报告预览',
        ),
      )
      .catch(() => {
        if (!c.signal.aborted) setStamp('PDF 状态暂不可用，可先打开报告预览');
      });
    return () => c.abort();
  }, [reportUrl]);
  return (
    <div className="report-actions">
      <a
        className="soft-button"
        href={reportUrl + (snapshot ? '&' : '?') + 'download=1'}
      >
        下载整站 PDF
      </a>
      <a
        className="soft-button"
        href={'/report' + (snapshot ? '?snapshot=' + snapshot : '')}
      >
        预览整站报告
      </a>
      <a className="soft-button" href="/sources">
        逐项数据核验
      </a>
      <span>{stamp}</span>
    </div>
  );
}
