import { useState, useEffect, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Batch {
  id: string;
  name: string;
  price: number;
  available_quantity: number;
  is_active: boolean;
  sort_order: number;
}

export function BatchManager({ eventId }: { eventId: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    const { data } = await supabase
      .from("ticket_batches")
      .select("id, name, price, available_quantity, is_active, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    setBatches((data as Batch[]) || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const activateBatch = async (batchId: string) => {
    setUpdatingId(batchId);
    // Optimistic UI: only one active at a time
    setBatches((prev) => prev.map((b) => ({ ...b, is_active: b.id === batchId })));

    const { data, error } = await supabase.rpc("activate_batch", { p_batch_id: batchId });
    const result = data as { success?: boolean; error?: string } | null;

    if (error || result?.error) {
      toast({
        title: "Erro ao ativar lote",
        description: result?.error || error?.message,
        variant: "destructive",
      });
      fetchBatches(); // revert
    } else {
      toast({ title: "Lote ativado!", description: "Este lote agora está disponível no checkout." });
    }
    setUpdatingId(null);
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Carregando lotes...</p>;
  }

  if (batches.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum lote criado.</p>;
  }

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lotes</p>
      {batches.map((batch) => (
        <div
          key={batch.id}
          className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">{batch.name}</span>
              {batch.is_active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPrice(Number(batch.price))} • {batch.available_quantity} disponíveis
            </p>
          </div>
          <Switch
            checked={batch.is_active}
            disabled={batch.is_active || updatingId === batch.id}
            onCheckedChange={() => activateBatch(batch.id)}
            aria-label={`Ativar lote ${batch.name}`}
          />
        </div>
      ))}
    </div>
  );
}
