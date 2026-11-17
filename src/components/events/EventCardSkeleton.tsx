import { Skeleton } from "@/components/ui/skeleton";

export function EventCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="overflow-hidden rounded-2xl bg-card shadow-card"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
        {/* pill de categoria */}
        <Skeleton className="absolute left-3 top-3 h-6 w-20 rounded-full bg-background/70" />
        {/* data • hora */}
        <Skeleton className="absolute bottom-3 left-3 h-4 w-32 bg-background/60" />
      </div>
      <div className="p-4">
        {/* título (text-lg leading-tight = 1.40625rem) */}
        <Skeleton className="mb-2 h-[1.40625rem] w-4/5" />
        {/* local */}
        <div className="mb-3 flex h-5 items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 flex-shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        {/* "A partir de" + preço */}
        <div className="flex h-7 items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </article>
  );
}

interface EventGridSkeletonProps {
  count?: number;
}

export function EventGridSkeleton({ count = 6 }: EventGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">Carregando eventos…</span>
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}