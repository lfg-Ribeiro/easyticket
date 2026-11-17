import { Skeleton } from "@/components/ui/skeleton";

/** Espelha o TicketCard (h-36): imagem, separador tracejado, título, status, data/local e ação. */
export function TicketCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="flex h-36 flex-row overflow-hidden rounded-2xl bg-card shadow-card"
    >
      {/* Miniatura */}
      <Skeleton className="w-32 flex-shrink-0 rounded-none" />

      {/* Separador tracejado com recortes */}
      <div className="relative flex w-0 flex-col items-center justify-center">
        <div className="absolute -top-4 z-10 h-8 w-8 rounded-full bg-background" />
        <div className="h-full border-l-2 border-dashed border-border" />
        <div className="absolute -bottom-4 z-10 h-8 w-8 rounded-full bg-background" />
      </div>

      {/* Informações */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
        {/* título + badge de status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20 flex-shrink-0 rounded-full" />
        </div>

        {/* data/hora e local */}
        <div className="mt-2 space-y-1.5">
          <div className="flex h-4 items-center gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-2/3" />
        </div>

        {/* quantidade + ação (QR Code) */}
        <div className="mt-2 flex h-4 items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-4 rounded-md" />
        </div>
      </div>
    </article>
  );
}

/** Cabeçalho de seção + 3 cards, no mesmo ritmo (space-y-3) da lista real. */
export function MyTicketsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando seus ingressos…</span>
      <Skeleton aria-hidden="true" className="mb-4 h-5 w-40" />
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <TicketCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}