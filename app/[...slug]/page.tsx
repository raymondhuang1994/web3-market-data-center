import Dashboard from '@/components/dashboard';
import { pages } from '@/lib/catalog';
import { notFound } from 'next/navigation';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (!pages.some((p) => p.path === '/' + slug.join('/'))) notFound();
  return <Dashboard key={slug.join('/')} />;
}
