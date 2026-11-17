import { Skeleton } from "@/components/ui/skeleton";

/** Espelha o MetricCard (p-5, ícone 11x11, valor text-2xl, rótulo text-sm). */
export function MetricCardSkeleton({ withSubtitle = false }: { withSubtitle?: boolean }) {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="mt-1.5 h-4 w-32" />
      {withSubtitle && <Skeleton className="mt-1.5 h-3 w-28" />}
    </div>
  );
}

/** 6 cards na ordem do dashboard; o 5º (Check-ins) tem subtítulo. */
export function MetricCardsSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">Carregando métricas…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <MetricCardSkeleton key={i} withSubtitle={i === 4} />
      ))}
    </>
  );
}

const BAR_HEIGHTS = ["h-2/5", "h-3/5", "h-1/3", "h-4/5", "h-1/2", "h-2/3", "h-3/4"];

/** Área do gráfico (dentro do container h-64 md:h-72 do SalesChart). */
export function SalesChartSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex h-full flex-col">
      <span className="sr-only">Carregando gráfico de vendas…</span>
      <div aria-hidden="true" className="relative flex flex-1 items-end gap-3 border-b border-border px-2 pb-0">
        {/* linhas-guia */}
        {["top-0", "top-1/3", "top-2/3"].map((pos) => (
          <div key={pos} className={`absolute inset-x-0 ${pos} border-t border-dashed border-border`} />
        ))}
        {BAR_HEIGHTS.map((height, i) => (
          <Skeleton key={i} className={`relative z-10 flex-1 rounded-t-md ${height}`} />
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between gap-3 px-2">
        {BAR_HEIGHTS.map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
    </div>
  );
}

const COLUMNS = ["Nome", "E-mail", "Evento", "Ingresso", "Status", "Data"];
const CELL_WIDTHS = ["w-28", "w-40", "w-32", "w-20", "w-20", "w-20"];

/** Tabela de participantes: cabeçalho real + linhas com a mesma altura (py-3 + text-sm). */
export function ParticipantsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="overflow-x-auto">
      <span className="sr-only">Carregando participantes…</span>
      <table aria-hidden="true" className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {COLUMNS.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {CELL_WIDTHS.map((width, col) => (
                <td key={col} className="px-4 py-3">
                  <Skeleton className={`h-5 ${width} ${col === 4 ? "rounded-full" : ""}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Espelha o EventListItem (p-4, imagem 20x20, título, data, vendas/receita e lotes). */
export function EventListItemSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-4 rounded-2xl bg-card p-4 shadow-card">
      <Skeleton className="h-20 w-20 flex-shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
        </div>
        <Skeleton className="mb-2 mt-1 h-5 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function EventListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Carregando eventos…</span>
      {Array.from({ length: count }, (_, i) => (
        <EventListItemSkeleton key={i} />
      ))}
    </div>
  );
}