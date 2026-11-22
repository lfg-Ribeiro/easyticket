import { Skeleton } from "@/components/ui/skeleton";

const LINE_WIDTHS = ["w-full", "w-full", "w-11/12", "w-2/3"];

/** Card principal (categoria, título, 4 linhas de metadados, lote e descrição). */
function DetailCardSkeleton({ className }: { className: string }) {
  return (
    <div className={`bg-card rounded-2xl shadow-elevated ${className}`}>
      {/* pills de categoria / lote */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      {/* título */}
      <Skeleton className="mb-4 h-8 w-3/4 md:h-9" />
      {/* 4 linhas de ícone + texto */}
      <div className="mb-6 grid gap-2.5">
        {["w-48", "w-16", "w-64", "w-40"].map((width, i) => (
          <div key={i} className="flex h-5 items-center gap-2">
            <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
            <Skeleton className={`h-4 max-w-full ${width}`} />
          </div>
        ))}
      </div>
      {/* faixa do lote ativo */}
      <Skeleton className="mb-6 h-[46px] w-full rounded-xl" />
      {/* Sobre o evento */}
      <Skeleton className="mb-2 h-5 w-36" />
      <div className="space-y-1.5">
        {LINE_WIDTHS.map((width, i) => (
          <Skeleton key={i} className={`h-4 ${width}`} />
        ))}
      </div>
    </div>
  );
}

/** Sidebar do CheckoutPanel (apenas desktop). */
function CheckoutPanelSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-elevated p-6 space-y-5">
      <Skeleton className="h-7 w-44" />

      {/* mini resumo do evento */}
      <div className="flex gap-3 rounded-xl bg-secondary p-3">
        <Skeleton className="h-14 w-14 flex-shrink-0 rounded-lg bg-muted-foreground/20" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-3/4 bg-muted-foreground/20" />
          <Skeleton className="h-3 w-1/2 bg-muted-foreground/20" />
        </div>
      </div>

      {/* lote ativo */}
      <Skeleton className="h-[46px] w-full rounded-xl" />

      {/* quantidade */}
      <div className="flex items-center justify-between border-b border-border py-3">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* campos do comprador */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}

      {/* forma de pagamento */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>

      {/* total + botão */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-7 w-24" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

/** Substitui o spinner de tela cheia da página de detalhe do evento. */
export function EventDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando evento…</span>

      {/* Hero */}
      <div aria-hidden="true" className="relative">
        <Skeleton className="aspect-[16/9] w-full rounded-none md:aspect-[21/9]" />
        <Skeleton className="absolute left-4 top-4 h-10 w-10 rounded-full bg-background/70 md:left-6 md:top-6" />
        <Skeleton className="absolute right-4 top-4 h-10 w-10 rounded-full bg-background/70 md:right-6 md:top-6" />
      </div>

      <div aria-hidden="true" className="container relative z-10 -mt-16 pb-32 md:pb-8">
        {/* Desktop */}
        <div className="hidden md:grid md:grid-cols-5 md:gap-8">
          <div className="md:col-span-3">
            <DetailCardSkeleton className="p-6 md:p-8" />
          </div>
          <div className="md:col-span-2">
            <CheckoutPanelSkeleton />
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <DetailCardSkeleton className="p-5" />
        </div>
      </div>

      {/* Barra fixa "Comprar agora" (mobile) */}
      <div
        aria-hidden="true"
        className="fixed bottom-[calc(4rem+max(1rem,env(safe-area-inset-bottom)))] left-0 right-0 z-40 flex h-20 items-center border-t border-border bg-background/95 px-4 backdrop-blur-lg md:hidden"
      >
        <div className="flex w-full items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}