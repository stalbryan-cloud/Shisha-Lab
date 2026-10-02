import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-raised motion-reduce:animate-none', className)} aria-hidden />;
}
export function CardGridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading recipes">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card overflow-hidden"><Skeleton className="aspect-[16/10] rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div></div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export const LoadingSkeleton = CardGridSkeleton;
