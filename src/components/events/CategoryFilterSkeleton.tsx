import { Skeleton } from "@/components/ui/skeleton";

const PILL_WIDTHS = ["w-16", "w-24", "w-20", "w-28", "w-20"];

export function CategoryFilterSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex gap-2 overflow-hidden pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap"
    >
      {PILL_WIDTHS.map((width, i) => (
        <Skeleton key={i} className={`h-9 flex-shrink-0 rounded-full ${width}`} />
      ))}
    </div>
  );
}