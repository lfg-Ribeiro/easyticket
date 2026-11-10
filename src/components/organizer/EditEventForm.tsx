import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EVENT_CATEGORIES = [
  "Festa Universitária",
  "Shows",
  "Teatro",
  "Esportes",
  "Tecnologia",
  "Gastronomia",
  "Comédia",
  "Arte & Cultura",
  "Outros",
];

interface BatchRow {
  id?: string;
  name: string;
  price: string;
  total_quantity: string;
  available_quantity: number;
  original_total: number;
  is_active: boolean;
  sort_order: number;
  isNew?: boolean;
}

interface EditEventFormProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditEventForm({ eventId, open, onOpenChange, onSaved }: EditEventFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [removedBatchIds, setRemovedBatchIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: "",
    event_time: "",
    event_end_time: "",
    location: "",
    venue: "",
    category: "",
    published: true,
    fee_absorbed: false,
    show_remaining_tickets: false,
    cover_image_url: "" as string | null,
    organizer_id: "",
  });

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setCoverFile(null);
    setCoverPreview(null);
    setRemovedBatchIds([]);

    const [{ data: ev, error }, { data: bs }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
      supabase
        .from("ticket_batches")
        .select("id, name, price, total_quantity, available_quantity, is_active, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
    ]);

    if (error || !ev) {
      toast({ title: "Erro ao carregar evento", description: error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setForm({
      title: ev.title ?? "",
      description: ev.description ?? "",
      event_date: ev.event_date ?? "",
      event_time: (ev.event_time ?? "").slice(0, 5),
      event_end_time: (ev.event_end_time ?? "")?.slice(0, 5) ?? "",
      location: ev.location ?? "",
      venue: ev.venue ?? "",
      category: ev.category ?? "Outros",
      published: !!ev.published,
      fee_absorbed: !!ev.fee_absorbed,
      show_remaining_tickets: !!ev.show_remaining_tickets,
      cover_image_url: ev.cover_image_url,
      organizer_id: ev.organizer_id,
    });

    setBatches(
      (bs || []).map((b) => ({
        id: b.id,
        name: b.name,
        price: String(b.price ?? ""),
        total_quantity: String(b.total_quantity ?? ""),
        available_quantity: b.available_quantity ?? 0,
        original_total: b.total_quantity ?? 0,
        is_active: !!b.is_active,
        sort_order: b.sort_order ?? 0,
      }))
    );
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (open && eventId) load();
  }, [open, eventId, load]);

  const setField = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateBatch = (index: number, field: keyof BatchRow, value: string | boolean) =>
    setBatches((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const setActiveBatch = (index: number) =>
    setBatches((prev) => prev.map((b, i) => ({ ...b, is_active: i === index })));

  const addBatch = () =>
    setBatches((prev) => [
      ...prev,
      {
        name: `Lote ${prev.length + 1}`,
        price: "",
        total_quantity: "",
        available_quantity: 0,
        original_total: 0,
        is_active: false,
        sort_order: prev.length,
        isNew: true,
      },
    ]);

  const removeBatch = (index: number) => {
    const batch = batches[index];
    if (batch.id && batch.total_quantity && batch.available_quantity < Number(batch.total_quantity)) {
      toast({
        title: "Lote com vendas",
        description: "Este lote já possui ingressos vendidos e não pode ser removido.",
        variant: "destructive",
      });
      return;
    }
    if (batch.id) setRemovedBatchIds((prev) => [...prev, batch.id!]);
    setBatches((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!eventId) return;
    if (!form.title || !form.event_date || !form.event_time || !form.location) {
      toast({ title: "Preencha título, data, horário e local", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let coverImageUrl = form.cover_image_url;
      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const fileName = `${form.organizer_id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("event-covers")
          .upload(fileName, coverFile);
        if (uploadError) {
          toast({ title: "Erro ao enviar imagem", description: uploadError.message, variant: "destructive" });
        } else {
          coverImageUrl = supabase.storage.from("event-covers").getPublicUrl(fileName).data.publicUrl;
        }
      }

      const { error: evError } = await supabase
        .from("events")
        .update({
          title: form.title,
          description: form.description || null,
          event_date: form.event_date,
          event_time: form.event_time,
          event_end_time: form.event_end_time || null,
          location: form.location,
          venue: form.venue || form.location.split(",")[0]?.trim() || form.location,
          category: form.category,
          published: form.published,
          fee_absorbed: form.fee_absorbed,
          show_remaining_tickets: form.show_remaining_tickets,
          cover_image_url: coverImageUrl,
        })
        .eq("id", eventId);

      if (evError) {
        toast({ title: "Erro ao salvar evento", description: evError.message, variant: "destructive" });
        return;
      }

      if (removedBatchIds.length > 0) {
        await supabase.from("ticket_batches").delete().in("id", removedBatchIds);
      }

      for (let i = 0; i < batches.length; i++) {
        const b = batches[i];
        if (!b.name || !b.price || !b.total_quantity) continue;
        const total = parseInt(b.total_quantity, 10);
        if (b.id) {
          const sold = Math.max(0, b.original_total - b.available_quantity);
          const { error } = await supabase
            .from("ticket_batches")
            .update({
              name: b.name,
              price: parseFloat(b.price),
              total_quantity: total,
              // keep stock consistent with what has already been sold
              available_quantity: Math.max(0, total - sold),
              is_active: b.is_active,
              sort_order: i,
              status: b.is_active ? "active" : "inactive",
            })
            .eq("id", b.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("ticket_batches").insert({
            event_id: eventId,
            name: b.name,
            price: parseFloat(b.price),
            total_quantity: total,
            available_quantity: total,
            is_active: b.is_active,
            sort_order: i,
            status: b.is_active ? "active" : "inactive",
          });
          if (error) throw error;
        }
      }

      toast({ title: "Evento atualizado com sucesso!" });
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Erro inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventId) return;
    setDeleting(true);
    try {
      const [{ count: ticketCount }, { count: orderCount }] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      ]);

      const hasHistory = (ticketCount || 0) > 0 || (orderCount || 0) > 0;

      if (hasHistory) {
        const { error } = await supabase
          .from("events")
          .update({ deleted_at: new Date().toISOString(), published: false })
          .eq("id", eventId);
        if (error) throw error;
        toast({
          title: "Evento arquivado",
          description: "Como já existem vendas, o evento foi arquivado para preservar o histórico financeiro.",
        });
      } else {
        await supabase.from("ticket_batches").delete().eq("event_id", eventId);
        const { error } = await supabase.from("events").delete().eq("id", eventId);
        if (error) throw error;
        toast({ title: "Evento excluído" });
      }

      setConfirmOpen(false);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Erro inesperado",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-xl font-bold">Editar Evento</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {form.published ? "Publicado" : "Pausado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.published
                      ? "Visível na home e aberto para vendas"
                      : "Oculto para novos compradores"}
                  </p>
                </div>
                <Switch
                  checked={form.published}
                  onCheckedChange={(v) => setField("published", v)}
                  aria-label="Alternar publicação do evento"
                />
              </div>

              {/* Cover */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Banner do Evento</Label>
                <div className="relative rounded-xl overflow-hidden bg-secondary aspect-video">
                  {coverPreview || form.cover_image_url ? (
                    <img
                      src={coverPreview || form.cover_image_url || ""}
                      alt={`Capa do evento ${form.title}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <Input type="file" accept="image/*" onChange={handleCoverChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title" className="text-sm font-semibold">Nome do Evento</Label>
                <Input
                  id="edit-title"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-date" className="text-sm font-semibold">Data</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setField("event_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-time" className="text-sm font-semibold">Início</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={form.event_time}
                    onChange={(e) => setField("event_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end" className="text-sm font-semibold">Término</Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={form.event_end_time}
                    onChange={(e) => setField("event_end_time", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location" className="text-sm font-semibold">Endereço</Label>
                <Input
                  id="edit-location"
                  value={form.location}
                  onChange={(e) => setField("location", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-venue" className="text-sm font-semibold">Local / Espaço</Label>
                <Input
                  id="edit-venue"
                  value={form.venue}
                  onChange={(e) => setField("venue", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-semibold">Descrição</Label>
                <Textarea
                  id="edit-description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Detalhes do evento, atrações, regras... (quebras de linha são preservadas)"
                  className="whitespace-pre-wrap"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Absorver taxa</p>
                  <p className="text-xs text-muted-foreground">A taxa é descontada do organizador</p>
                </div>
                <Switch
                  checked={form.fee_absorbed}
                  onCheckedChange={(v) => setField("fee_absorbed", v)}
                  aria-label="Absorver taxa de serviço"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Exibir quantidade de ingressos restantes</p>
                  <p className="text-xs text-muted-foreground">Ative para gerar escassez no público quando o lote estiver perto do fim</p>
                </div>
                <Switch
                  checked={form.show_remaining_tickets}
                  onCheckedChange={(v) => setField("show_remaining_tickets", v)}
                  aria-label="Exibir quantidade de ingressos restantes"
                />
              </div>

              {/* Batches */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Lotes de Ingressos</Label>
                  <Button variant="outline" size="sm" onClick={addBatch}>
                    <Plus className="h-4 w-4 mr-1" />
                    Novo lote
                  </Button>
                </div>

                {batches.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum lote cadastrado.</p>
                )}

                {batches.map((batch, index) => (
                  <div key={batch.id ?? `new-${index}`} className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={batch.name}
                        onChange={(e) => updateBatch(index, "name", e.target.value)}
                        placeholder="Nome do lote"
                        className="h-9"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBatch(index)}
                        aria-label={`Remover ${batch.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={batch.price}
                          onChange={(e) => updateBatch(index, "price", e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quantidade total</Label>
                        <Input
                          type="number"
                          min="0"
                          value={batch.total_quantity}
                          onChange={(e) => updateBatch(index, "total_quantity", e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {batch.id ? `${batch.available_quantity} disponíveis` : "Novo lote"}
                      </span>
                      <div className="flex items-center gap-2">
                        {batch.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Ativo
                          </span>
                        )}
                        <Switch
                          checked={batch.is_active}
                          disabled={batch.is_active}
                          onCheckedChange={() => setActiveBatch(index)}
                          aria-label={`Ativar ${batch.name}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex-row gap-3 border-t border-border px-6 py-4 pb-6">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={saving || loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <Button variant="gradient" className="flex-1" onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir evento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o evento? Esta ação não pode ser desfeita. Se já houver
              ingressos ou pedidos vinculados, o evento será apenas arquivado para preservar o
              histórico financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Processando..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
