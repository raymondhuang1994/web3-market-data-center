import { db } from '@/lib/db';
import { reportStorage } from '@/lib/storage';
export async function GET(request: Request) {
  try {
    const report = await db()
      .prepare(
        'SELECT snapshot_id,object_key,byte_count,data_generated_at,created_at,pdf_hash FROM reports ORDER BY data_generated_at DESC LIMIT 1',
      )
      .first<{
        snapshot_id: string;
        object_key: string;
        byte_count: number;
        data_generated_at: string;
        created_at: string;
        pdf_hash: string;
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
          href: '/api/reports/latest?download=1',
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
        'Content-Disposition': `attachment; filename="web3-market-report-${report.data_generated_at.slice(0, 10)}.pdf"`,
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
