import { Button } from "@/components/ui/button";

interface MobilePurchaseBarProps {
  /** Preço do lote ativo já formatado em BRL (ex.: "R$ 50,00"). */
  priceLabel: string;
  /** Nome do lote ativo (ex.: "Lote 1"). */
  batchName?: string;
  soldOut: boolean;
  onBuy: () => void;
}

/**
 * Barra fixa de compra — somente no celular (md:hidden).
 *
 * Posição: logo acima da MobileNav, que tem 4rem + max(1rem, safe-area) de altura.
 * A barra tem altura fixa (h-20 = 5rem) e fica em z-40, abaixo dos drawers/modais (z-50).
 * FloatingWhatsApp usa esses mesmos valores para ficar acima da barra: se mudar um, mude o outro.
 */
export function MobilePurchaseBar({ priceLabel, batchName, soldOut, onBuy }: MobilePurchaseBarProps) {
  return (
    <div
      role="region"
      aria-label="Comprar ingresso"
      data-testid="mobile-purchase-bar"
      className="fixed bottom-[calc(4rem+max(1rem,env(safe-area-inset-bottom)))] left-0 right-0 z-40 flex h-20 items-center justify-between gap-3 border-t border-border bg-background/95 px-4 backdrop-blur-lg md:hidden"
    >
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">
          {soldOut ? (batchName ?? "Ingressos") : batchName ? `${batchName} • A partir de` : "A partir de"}
        </p>
        <p className="truncate text-xl font-bold text-foreground">
          {soldOut ? "Ingressos esgotados" : priceLabel}
        </p>
      </div>
      <Button
        type="button"
        variant="gradient"
        size="lg"
        onClick={onBuy}
        disabled={soldOut}
        aria-disabled={soldOut}
        className="min-h-[44px] shrink-0 px-5"
      >
        {soldOut ? "Esgotado" : "Comprar ingresso"}
      </Button>
    </div>
  );
}
