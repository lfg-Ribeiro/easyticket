import { Link } from "react-router-dom";
import { Home, ReceiptText, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PurchaseFallbackProps {
  /** missing: a URL veio sem dados do pedido; unavailable: não foi possível carregar o evento. */
  reason: "missing" | "unavailable";
  orderRef?: string | null;
}

const COPY = {
  missing: "Esta página mostra o resumo de uma compra recém-finalizada, mas não recebemos os dados do pedido.",
  unavailable: "Não foi possível carregar os detalhes desta compra neste momento.",
} as const;

/** Estado amigável para links sem dados ou pedidos que não puderam ser carregados. */
export function PurchaseFallback({ reason, orderRef }: PurchaseFallbackProps) {
  return (
    <section
      aria-labelledby="purchase-fallback-title"
      className="space-y-5 rounded-2xl bg-card p-8 text-center shadow-card animate-fade-up"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <ReceiptText className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 id="purchase-fallback-title" className="text-xl font-bold text-foreground">
          Não encontramos os dados da sua compra
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {COPY[reason]} Se você já pagou, fique tranquilo: seus ingressos foram enviados por e-mail e ficam
          disponíveis em Meus Ingressos.
        </p>
        {orderRef && (
          <p className="text-xs text-muted-foreground">
            Referência do pedido: <span className="font-mono font-semibold text-foreground">{orderRef}</span>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild variant="gradient" size="lg">
          <Link to="/tickets">
            <Ticket />
            Ver meus ingressos
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/">
            <Home />
            Explorar eventos
          </Link>
        </Button>
      </div>
    </section>
  );
}
