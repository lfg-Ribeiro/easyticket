import { useRef, useState } from "react";
import { Check, ChevronRight, Image, MapPin, Calendar, Tag, Settings, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { cn } from "@/lib/utils";
import {
  ERROR_SELECT_CLASS,
  describedBy,
  errorClass,
  eventValidators,
  focusFirstInvalid,
  updateBatchFieldError,
  validateBatchName,
  validateBatchPrice,
  validateBatchQuantity,
  validateBatchRows,
  validateEventBasics,
  type BatchErrors,
  type BatchField,
  type EventField,
} from "@/lib/validation";
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
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MetaTrackingFields, type MetaTrackingValue } from "@/components/organizer/MetaTrackingFields";
import { saveMetaTracking } from "@/lib/metaTracking";

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
  const { user, isAdmin, isMasterAdmin } = useAuth();
  const canEditTracking = isAdmin || isMasterAdmin;
  const [metaTracking, setMetaTracking] = useState<MetaTrackingValue>({ pixelId: "", capiToken: "" });
  const [currentStep, setCurrentStep] = useState(1);
  const [feeAbsorbed, setFeeAbsorbed] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
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
    category: "",
  });
  const { errors, setErrors, revalidate, clearErrors } = useFieldErrors<EventField>();
  const [batchErrors, setBatchErrors] = useState<Record<string, BatchErrors>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const nextBatchId = useRef(2); // ids únicos mesmo após remover lotes

  const batchFieldValidators: Record<BatchField, (value: string) => string | undefined> = {
    name: validateBatchName,
    price: validateBatchPrice,
    quantity: (value) => validateBatchQuantity(value),
  };

  /** Atualiza um campo do evento e remove o erro dele assim que o valor for válido. */
  const setEventField = (field: keyof typeof formData, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    if (field in eventValidators) {
      revalidate(field as EventField, eventValidators[field as EventField](next));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    const field = id.replace("event-", "") as keyof typeof formData;
    setEventField(field, value);
  };

  const validateStepOne = () => {
    const next = validateEventBasics(formData);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(contentRef.current);
      return false;
    }
    return true;
  };

  const validateStepTwo = () => {
    const { rowErrors } = validateBatchRows(
      batches.map((b) => ({ key: b.id, name: b.name, price: b.price, quantity: b.quantity })),
    );
    setBatchErrors(rowErrors);
    if (Object.keys(rowErrors).length > 0) {
      focusFirstInvalid(contentRef.current);
      return false;
    }
    return true;
  };

  /** Voltar é livre; avançar exige que as etapas anteriores ao destino estejam válidas. */
  const goToStep = (target: number) => {
    if (target <= currentStep) {
      setCurrentStep(target);
      return;
    }
    if (currentStep <= 1 && target >= 2 && !validateStepOne()) {
      setCurrentStep(1);
      return;
    }
    if (currentStep <= 2 && target >= 3 && !validateStepTwo()) {
      setCurrentStep(2);
      return;
    }
    setCurrentStep(target);
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
      { id: String(nextBatchId.current++), name: `Lote ${prev.length + 1}`, price: "", quantity: "" },
    ]);
  };

  const removeBatch = (id: string) => {
    if (batches.length > 1) {
      setBatches((prev) => prev.filter((b) => b.id !== id));
      setBatchErrors((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const updateBatch = (id: string, field: keyof TicketBatch, value: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
    if (field !== "id") {
      setBatchErrors((prev) =>
        updateBatchFieldError(prev, id, field, batchFieldValidators[field](value)),
      );
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFeeAbsorbed(false);
    setShowRemaining(false);
    setCoverFile(null);
    setCoverPreview(null);
    setBatches([{ id: "1", name: "Lote 1", price: "", quantity: "" }]);
    setFormData({ title: "", date: "", time: "", location: "", description: "", category: "" });
    nextBatchId.current = 2;
    clearErrors();
    setBatchErrors({});
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Faça login para criar eventos", variant: "destructive" });
      return;
    }

    // Validação final (cobre quem chegou à etapa 3 sem passar pelos botões "Próximo")
    if (!validateStepOne()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStepTwo()) {
      setCurrentStep(2);
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
          show_remaining_tickets: showRemaining,
          published: true,
        })
        .select()
        .single();

      if (eventError) {
        console.error("Event error:", eventError);
        toast({ title: "Erro ao criar evento", description: eventError.message, variant: "destructive" });
        return;
      }

      if (canEditTracking && (metaTracking.pixelId || metaTracking.capiToken)) {
        try {
          await saveMetaTracking(event.id, metaTracking);
        } catch (err: any) {
          toast({ title: "Rastreamento Meta não salvo", description: err?.message, variant: "destructive" });
        }
      }

      // Create ticket batches
      const validBatches = batches.filter((b) => b.price && b.quantity);
      if (validBatches.length > 0) {
        const batchData = validBatches.map((b, index) => ({
          event_id: event.id,
          name: b.name,
          price: parseFloat(b.price),
          total_quantity: parseInt(b.quantity),
          available_quantity: parseInt(b.quantity),
          sort_order: index,
          status: index === 0 ? "active" : "inactive",
          is_active: index === 0,
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
      <DialogContent ref={contentRef} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Criar Novo Evento</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => goToStep(step.id)}
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
                Nome do Evento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ex: Festival de Verão 2025"
                className={errorClass(errors.title)}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={describedBy("event-title", errors.title)}
              />
              <FieldError id="event-title" message={errors.title} />
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label htmlFor="event-category" className="text-sm font-semibold">
                <Tag className="h-4 w-4 inline mr-1" />
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setEventField("category", value)}
              >
                <SelectTrigger
                  id="event-category"
                  className={errorClass(errors.category, ERROR_SELECT_CLASS)}
                  aria-invalid={errors.category ? true : undefined}
                  aria-describedby={describedBy("event-category", errors.category)}
                >
                  <SelectValue placeholder="Selecione uma categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="event-category" message={errors.category} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="event-date" className="text-sm font-semibold">
                  Data <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className={errorClass(errors.date)}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={describedBy("event-date", errors.date)}
                />
                <FieldError id="event-date" message={errors.date} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time" className="text-sm font-semibold">
                  Horário <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="event-time"
                  type="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  className={errorClass(errors.time)}
                  aria-invalid={errors.time ? true : undefined}
                  aria-describedby={describedBy("event-time", errors.time)}
                />
                <FieldError id="event-time" message={errors.time} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-location" className="text-sm font-semibold">
                <MapPin className="h-4 w-4 inline mr-1" />
                Local <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Ex: Parque Ibirapuera, São Paulo"
                className={errorClass(errors.location)}
                aria-invalid={errors.location ? true : undefined}
                aria-describedby={describedBy("event-location", errors.location)}
              />
              <FieldError id="event-location" message={errors.location} />
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
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={coverPreview} alt="Cover preview" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCoverFile(null);
                        setCoverPreview(null);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-foreground/70 text-background hover:bg-foreground/90 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/50 to-transparent p-3 pointer-events-none">
                      <span className="text-xs text-background font-medium">Clique na imagem para alterar</span>
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
              onClick={() => goToStep(2)}
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
              {batches.map((batch) => {
                const rowErrors = batchErrors[batch.id] ?? {};
                const hasRowErrors = Object.keys(rowErrors).length > 0;
                const nameId = `batch-${batch.id}-name`;
                const priceId = `batch-${batch.id}-price`;
                const quantityId = `batch-${batch.id}-quantity`;
                return (
                  <div
                    key={batch.id}
                    className={cn(
                      "bg-secondary rounded-xl p-4 space-y-3 border border-transparent",
                      hasRowErrors && "border-destructive/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Input
                          id={nameId}
                          value={batch.name}
                          onChange={(e) => updateBatch(batch.id, "name", e.target.value)}
                          aria-label="Nome do lote"
                          className={cn(
                            "font-semibold bg-transparent border-none p-0 h-auto text-base focus-visible:ring-0",
                            rowErrors.name && `${errorClass(rowErrors.name)} border-solid bg-background px-2 py-1.5 focus-visible:ring-1`
                          )}
                          aria-invalid={rowErrors.name ? true : undefined}
                          aria-describedby={describedBy(nameId, rowErrors.name)}
                        />
                        <FieldError id={nameId} message={rowErrors.name} />
                      </div>
                      {batches.length > 1 && (
                        <button
                          onClick={() => removeBatch(batch.id)}
                          aria-label={`Remover ${batch.name || "lote"}`}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={priceId} className="text-xs text-muted-foreground">Preço (R$)</Label>
                        <Input
                          id={priceId}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          value={batch.price}
                          onChange={(e) => updateBatch(batch.id, "price", e.target.value)}
                          className={errorClass(rowErrors.price)}
                          aria-invalid={rowErrors.price ? true : undefined}
                          aria-describedby={describedBy(priceId, rowErrors.price)}
                        />
                        <FieldError id={priceId} message={rowErrors.price} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={quantityId} className="text-xs text-muted-foreground">Quantidade</Label>
                        <Input
                          id={quantityId}
                          type="number"
                          min="1"
                          step="1"
                          placeholder="100"
                          value={batch.quantity}
                          onChange={(e) => updateBatch(batch.id, "quantity", e.target.value)}
                          className={errorClass(rowErrors.quantity)}
                          aria-invalid={rowErrors.quantity ? true : undefined}
                          aria-describedby={describedBy(quantityId, rowErrors.quantity)}
                        />
                        <FieldError id={quantityId} message={rowErrors.quantity} />
                      </div>
                    </div>
                  </div>
                );
              })}
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
                onClick={() => goToStep(3)}
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

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <p className="font-semibold text-foreground text-sm">Exibir quantidade de ingressos restantes</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ative para gerar escassez no público quando o lote estiver perto do fim
                  </p>
                </div>
                <Switch checked={showRemaining} onCheckedChange={setShowRemaining} />
              </div>
            </div>

            {canEditTracking && <MetaTrackingFields value={metaTracking} onChange={setMetaTracking} />}

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
                  <span className="text-foreground font-medium">
                    {feeAbsorbed ? "Absorvida por você" : "R$ 5,00"}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between font-semibold">
                  <span className="text-foreground">Total pago pelo cliente</span>
                  <span className="text-foreground">
                    {feeAbsorbed ? "R$ 100,00" : "R$ 105,00"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Você recebe</span>
                  <span className="text-success font-semibold">
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
                {submitting ? "Criando..." : "Criar Evento 🎉"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
