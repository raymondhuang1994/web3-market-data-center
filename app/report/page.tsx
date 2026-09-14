import { ReportDocument } from '@/components/report-document';
import { readBundle } from '@/lib/bundles';
import { notFound } from 'next/navigation';
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ snapshot?: string }>;
}) {
  const { snapshot } = await searchParams;
  if (snapshot && !/^[a-f0-9]{64}$/.test(snapshot)) notFound();
  const bundle = await readBundle(snapshot);
  if (!bundle) notFound();
  return <ReportDocument bundle={bundle} />;
}
