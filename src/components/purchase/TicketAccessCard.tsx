import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Lock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_PREVIEWS = 4;

interface TicketAccessCardProps {
  qrCodes: string[];
  quantity: number;
  confirmed: boolean;
  email?: string;
}

/** Acesso rápido: pré-visualização do(s) QR Code(s) e CTA para Meus Ingressos. */
export function TicketAccessCard({ qrCodes, quantity, confirmed, email }: TicketAccessCardProps) {
  const previews = qrCodes.slice(0, MAX_PREVIEWS);
  const hidden = Math.max(quantity, qrCodes.length) - previews.length;

  return (
    <section aria-label="Acesso rápido ao ingresso" className="space-y-4 rounded-2xl bg-card p-5 text-center shadow-card">
      {!confirmed ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <Lock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Seu QR Code será liberado assim que o pagamento for confirmado.
          </p>
        </div>
      ) : previews.length > 0 ? (
        <div className="space-y-3">
          <div className={previews.length === 1 ? "flex justify-center" : "grid grid-cols-2 justify-items-center gap-3"}>
            {previews.map((code, index) => (
              <div
                key={`${code}-${index}`}
                role="img"
                aria-label={`QR Code do ingresso ${index + 1}`}
                className="rounded-xl bg-white p-3 shadow-sm"
              >
                <QRCodeSVG value={code} size={previews.length === 1 ? 168 : 104} level="M" />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {hidden > 0
              ? `Mostrando ${previews.length} de ${previews.length + hidden} ingressos. Os demais estão em Meus Ingressos.`
              : "Apresente este QR Code na portaria do evento."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <QrCode className="h-8 w-8 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Seu QR Code já está disponível em Meus Ingressos.
          </p>
        </div>
      )}

      <Button asChild variant="gradient" size="lg" className="w-full">
        <Link to="/tickets">Acessar Meus Ingressos</Link>
      </Button>
      {email && (
        <p className="text-xs text-muted-foreground">
          Entre com <span className="font-semibold text-foreground">{email}</span> para ver todos os seus ingressos.
        </p>
      )}
    </section>
  );
}
