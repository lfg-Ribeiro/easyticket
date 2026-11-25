import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Megaphone } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MetaTrackingValue {
  pixelId: string;
  capiToken: string;
}

interface Props {
  value: MetaTrackingValue;
  onChange: (v: MetaTrackingValue) => void;
  loading?: boolean;
}

export function MetaTrackingFields({ value, onChange, loading }: Props) {
  const [open, setOpen] = useState(!!value.pixelId);
  const [showToken, setShowToken] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-primary" />
            Rastreamento & Tráfego Pago (Meta Ads)
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-4 pb-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="meta-pixel-id">ID do Pixel da Meta</Label>
              <Input
                id="meta-pixel-id"
                inputMode="numeric"
                placeholder="Ex: 2543694912825062"
                value={value.pixelId}
                onChange={(e) => onChange({ ...value, pixelId: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-capi-token">Token da API de Conversões (CAPI)</Label>
              <div className="relative">
                <Input
                  id="meta-capi-token"
                  type={showToken ? "text" : "password"}
                  autoComplete="off"
                  className="pr-10"
                  value={value.capiToken}
                  onChange={(e) => onChange({ ...value, capiToken: e.target.value.trim() })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10"
                  onClick={() => setShowToken((s) => !s)}
                  aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Fica guardado de forma privada e só é usado pelo servidor.</p>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
