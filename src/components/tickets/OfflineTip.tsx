import { WifiOff } from "lucide-react";

export function OfflineTip() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/70 border border-border/50">
      <WifiOff className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground">Dica:</span> Tire um print deste ingresso para garantir o acesso mesmo sem internet na porta do evento.
      </p>
    </div>
  );
}
