import { Skeleton } from '@/components/ui/LoadingSkeleton';
export default function Loading() {
  return <div className="container space-y-4 py-10" role="status" aria-label="Loading recipe"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-64 w-full" /><span className="sr-only">Loading…</span></div>;
}
