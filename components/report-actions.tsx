'use client';
/* oxlint-disable next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
import { sourceTime } from '@/lib/quality';
export function ReportActions() {
  const [stamp, setStamp] = useState('正在检查报告状态');
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/reports/latest', { signal: c.signal })
      .then((r) => (r.ok ? r.json() as Promise<{ dataGeneratedAt?: string }> : null))
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
  }, []);
  return (
    <div className="report-actions">
      <a className="soft-button" href="/api/reports/latest?download=1">
        下载整站 PDF
      </a>
      <a className="soft-button" href="/report">
        预览整站报告
      </a>
      <a className="soft-button" href="/sources">
        逐项数据核验
      </a>
      <span>{stamp}</span>
    </div>
  );
}
