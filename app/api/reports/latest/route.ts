import { db } from '@/lib/db';
import { reportStorage } from '@/lib/storage';
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('snapshot');
  if (requested && !/^[a-f0-9]{64}$/.test(requested)) return Response.json({ error: 'Invalid snapshot' }, { status: 400 });
  try {
    const query = requested ? db().prepare('SELECT r.snapshot_id,r.object_key,r.byte_count,r.data_generated_at,r.created_at,r.pdf_hash,e.report_date,e.cutoff_at,e.analysis_hash,e.published_at FROM reports r LEFT JOIN daily_editions e ON e.snapshot_id=r.snapshot_id WHERE r.snapshot_id=? AND (e.snapshot_id IS NULL OR e.published_at IS NOT NULL)').bind(requested) : db().prepare(
        'SELECT r.snapshot_id,r.object_key,r.byte_count,r.data_generated_at,r.created_at,r.pdf_hash,e.report_date,e.cutoff_at,e.analysis_hash,e.published_at FROM current_snapshot c JOIN reports r ON r.snapshot_id=c.snapshot_id LEFT JOIN daily_editions e ON e.snapshot_id=c.snapshot_id WHERE c.id=1',
      );
    const report = await query.first<{
        snapshot_id: string;
        object_key: string;
        byte_count: number;
        data_generated_at: string;
        created_at: string;
        pdf_hash: string;
        report_date: string | null;
        cutoff_at: string | null;
        analysis_hash: string | null;
        published_at: string | null;
      }>();
    if (!report)
      return new Response(
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>报告生成中</title><body style="font-family:sans-serif;padding:40px"><h1>整站报告正在准备</h1><p>首次报告尚未发布，或最近一次生成失败。数据页面继续正常更新。</p><a href="/report">打开报告预览并保存为 PDF</a> · <a href="/">返回数据中心</a></body></html>',
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'no-store',
          },
        },
      );
    if (new URL(request.url).searchParams.get('download') !== '1')
      return Response.json(
        {
          snapshotId: report.snapshot_id,
          dataGeneratedAt: report.data_generated_at,
          createdAt: report.created_at,
          bytes: report.byte_count,
          reportDate: report.report_date,
          cutoffAt: report.cutoff_at,
          analysisHash: report.analysis_hash,
          publishedAt: report.published_at,
          href: '/api/reports/latest?download=1&snapshot=' + report.snapshot_id,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    const file = await reportStorage().get(report.object_key);
    if (!file)
      return Response.json(
        { error: 'Report unavailable; try preview at /report' },
        { status: 503 },
      );
    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="web3-market-report-${report.report_date || report.data_generated_at.slice(0, 10)}.pdf"`,
        'Content-Length': String(file.size),
        'Cache-Control': 'no-cache',
        ETag: '"' + report.pdf_hash + '"',
        'X-Data-Generated-At': report.data_generated_at,
        'X-Snapshot-Id': report.snapshot_id,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json(
      { error: 'Report service unavailable; previous data unaffected' },
      { status: 503 },
    );
  }
}
