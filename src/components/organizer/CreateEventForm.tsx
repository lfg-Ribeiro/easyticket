import { useState } from "react";
import { Check, ChevronRight, Image, MapPin, Calendar, Tag, Settings, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TicketBatch {
  id: string;
  name: string;
  price: string;
  quantity: string;
}

interface CreateEventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated?: () => void;
}

const steps = [
  { id: 1, label: "Informações", icon: Calendar },
  { id: 2, label: "Ingressos", icon: Tag },
  { id: 3, label: "Taxas", icon: Settings },
];

export function CreateEventForm({ open, onOpenChange, onEventCreated }: CreateEventFormProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [feeAbsorbed, setFeeAbsorbed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [batches, setBatches] = useState<TicketBatch[]>([
    { id: "1", name: "Lote 1", price: "", quantity: "" },
  ]);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    description: "",
    category: "Outros",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    const field = id.replace("event-", "");
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const addBatch = () => {
    setBatches((prev) => [
      ...prev,
      { id: String(prev.length + 1), name: `Lote ${prev.length + 1}`, price: "", quantity: "" },
    ]);
  };

  const removeBatch = (id: string) => {
    if (batches.length > 1) {
      setBatches((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const updateBatch = (id: string, field: keyof TicketBatch, value: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFeeAbsorbed(false);
    setCoverFile(null);
    setCoverPreview(null);
    setBatches([{ id: "1", name: "Lote 1", price: "", quantity: "" }]);
    setFormData({ title: "", date: "", time: "", location: "", description: "", category: "Outros" });
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Faça login para criar eventos", variant: "destructive" });
      return;
    }

    if (!formData.title || !formData.date || !formData.time || !formData.location) {
      toast({ title: "Preencha as informações básicas", variant: "destructive" });
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    try {
      // Upload cover image if provided
      let coverImageUrl: string | null = null;
      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("event-covers")
          .upload(fileName, coverFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("event-covers")
            .getPublicUrl(fileName);
          coverImageUrl = urlData.publicUrl;
        }
      }

      // Create event
      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({
          organizer_id: user.id,
          title: formData.title,
          description: formData.description || null,
          event_date: formData.date,
          event_time: formData.time,
          location: formData.location,
          venue: formData.location.split(",")[0]?.trim() || formData.location,
          category: formData.category,
          cover_image_url: coverImageUrl,
          fee_absorbed: feeAbsorbed,
          published: true,
        })
        .select()
        .single();

      if (eventError) {
        console.error("Event error:", eventError);
        toast({ title: "Erro ao criar evento", description: eventError.message, variant: "destructive" });
        return;
      }

      // Create ticket batches
      const validBatches = batches.filter((b) => b.price && b.quantity);
      if (validBatches.length > 0) {
        const batchData = validBatches.map((b) => ({
          event_id: event.id,
          name: b.name,
          price: parseFloat(b.price),
          total_quantity: parseInt(b.quantity),
          available_quantity: parseInt(b.quantity),
        }));

        const { error: batchError } = await supabase
          .from("ticket_batches")
          .insert(batchData);

        if (batchError) {
          console.error("Batch error:", batchError);
        }
      }

      toast({ title: "Evento criado com sucesso! 🎉" });
      resetForm();
      onOpenChange(false);
      onEventCreated?.();
    } catch (err) {
      console.error("Submit error:", err);
      toast({ title: "Erro inesperado ao criar evento", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Criar Novo Evento</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 flex-1 p-3 rounded-xl transition-colors ${
                  currentStep === step.id
                    ? "bg-primary/10 text-primary"
                    : currentStep > step.id
                    ? "bg-success/10 text-success"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep > step.id
                      ? "bg-success text-success-foreground"
                      : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-3.5 w-3.5" /> : step.id}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="event-title" className="text-sm font-semibold">
                Nome do Evento
              </Label>
              <Input
                id="event-title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ex: Festival de Verão 2025"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="event-date" className="text-sm font-semibold">
                  Data
                </Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.date}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time" className="text-sm font-semibold">
                  Horário
                </Label>
                <Input
                  id="event-time"
                  type="time"
                  value={formData.time}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-location" className="text-sm font-semibold">
                <MapPin className="h-4 w-4 inline mr-1" />
                Local
              </Label>
              <Input
                id="event-location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Ex: Parque Ibirapuera, São Paulo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description" className="text-sm font-semibold">
                Descrição
              </Label>
              <Textarea
                id="event-description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descreva seu evento..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                <Image className="h-4 w-4 inline mr-1" />
                Imagem de Capa
              </Label>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
                {coverPreview ? (
                  <div className="relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                    <img src={coverPreview} alt="Cover preview" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
                      <span className="text-sm text-primary-foreground bg-foreground/50 px-3 py-1 rounded-full">
                        Alterar imagem
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors">
                    <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar uma imagem
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG até 5MB
                    </p>
                  </div>
                )}
              </label>
            </div>

            <Button
              variant="gradient"
              className="w-full"
              onClick={() => setCurrentStep(2)}
            >
              Próximo: Ingressos
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Ticket Batches */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Defina os lotes e preços dos ingressos para o seu evento.
            </p>

            <div className="space-y-3">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="bg-secondary rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Input
                      value={batch.name}
                      onChange={(e) => updateBatch(batch.id, "name", e.target.value)}
                      className="font-semibold bg-transparent border-none p-0 h-auto text-base focus-visible:ring-0"
                    />
                    {batches.length > 1 && (
                      <button
                        onClick={() => removeBatch(batch.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
                      <Input
                        type="number"
                        placeholder="0,00"
                        value={batch.price}
                        onChange={(e) => updateBatch(batch.id, "price", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Quantidade</Label>
                      <Input
                        type="number"
                        placeholder="100"
                        value={batch.quantity}
                        onChange={(e) => updateBatch(batch.id, "quantity", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={addBatch}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Lote
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCurrentStep(1)}
              >
                Voltar
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={() => setCurrentStep(3)}
              >
                Próximo: Taxas
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Fee Configuration */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configure como a taxa de serviço será aplicada.
            </p>

            <div className="bg-secondary rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Taxa de serviço: 5%</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Uma das menores taxas do mercado
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <p className="font-semibold text-foreground text-sm">Absorver taxa</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feeAbsorbed
                      ? "Você paga a taxa. O cliente vê o preço cheio."
                      : "O cliente paga a taxa no checkout."}
                  </p>
                </div>
                <Switch checked={feeAbsorbed} onCheckedChange={setFeeAbsorbed} />
              </div>
            </div>

            {/* Example Preview */}
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/10">
              <p className="text-sm font-semibold text-foreground mb-3">
                Exemplo para ingresso de R$ 100,00
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço do ingresso</span>
                  <span className="text-foreground font-medium">R$ 100,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de serviço (5%)</span>
                  <span className="text-foreground font-medium">R$ 5,00</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente paga</span>
                  <span className="text-foreground font-bold">
                    {feeAbsorbed ? "R$ 100,00" : "R$ 105,00"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Você recebe</span>
                  <span className="text-success font-bold">
                    {feeAbsorbed ? "R$ 95,00" : "R$ 100,00"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCurrentStep(2)}
              >
                Voltar
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Criar Evento
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
