import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, CreditCard, QrCode, Copy, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/types/event";

interface CheckoutPanelProps {
  event: Event;
}

type PaymentMethod = "card" | "pix";
type CheckoutStep = "form" | "processing";

export function CheckoutPanel({ event }: CheckoutPanelProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>("form");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixGenerated, setPixGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
  });

  const subtotal = event.price * quantity;
  const serviceFee = subtotal * 0.05;
  const total = subtotal + serviceFee;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(10, prev + delta)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData((prev) => ({ ...prev, cpf: formatted }));
  };

  const isFormValid = formData.name.trim() && formData.email.includes("@") && formData.cpf.length >= 14;

  const createCheckout = async () => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        event_id: event.id,
        buyer_name: formData.name,
        buyer_email: formData.email,
        buyer_cpf: formData.cpf,
        quantity,
        payment_method: paymentMethod,
      },
    });

    if (error) {
      throw new Error("Checkout failed");
    }

    return data;
  };

  const navigateToSuccess = (txn: string) => {
    const params = new URLSearchParams({
      eventId: event.id,
      name: formData.name,
      email: formData.email,
      quantity: quantity.toString(),
      txn,
    });
    navigate(`/purchase-success?${params.toString()}`);
  };

  const handleGeneratePix = async () => {
    if (!isFormValid) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setIsGeneratingPix(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsGeneratingPix(false);
    setPixGenerated(true);
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText("00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Código PIX copiado!" });
  };

  const handleCheckoutSuccess = (result: any) => {
    // Email toast + console log
    console.log("📧 [EMAIL DATA]", {
      to: formData.email,
      event: event.title,
      ticketLink: `https://easyticket.com/tickets`,
      emailSent: result.email_sent,
      emailData: result.email_data,
    });
    toast({ title: `📧 E-mail de confirmação enviado para ${formData.email}` });
    navigateToSuccess(result.transaction_id);
  };

  const handleConfirmPayment = async () => {
    setStep("processing");
    try {
      const result = await createCheckout();
      handleCheckoutSuccess(result);
    } catch {
      setStep("form");
      toast({ title: "Erro ao processar pagamento", variant: "destructive" });
    }
  };

  const handleCardPayment = async () => {
    if (!isFormValid) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setStep("processing");
    try {
      const result = await createCheckout();
      handleCheckoutSuccess(result);
    } catch {
      setStep("form");
      toast({ title: "Erro ao processar pagamento", variant: "destructive" });
    }
  };

  if (step === "processing") {
    return (
      <div className="bg-card rounded-2xl shadow-elevated p-6 text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-lg font-semibold text-foreground">Processando pagamento...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-elevated p-6 space-y-5 sticky top-24">
      <h2 className="text-xl font-bold text-foreground">Finalizar Compra</h2>

      {/* Event Mini Summary */}
      <div className="flex gap-3 p-3 bg-secondary rounded-xl">
        <img
          src={event.image}
          alt={event.title}
          className="w-14 h-14 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm line-clamp-1">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{event.venue}</p>
        </div>
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <span className="font-medium text-foreground">Quantidade</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleQuantityChange(-1)}
            disabled={quantity <= 1}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-lg font-bold w-6 text-center">{quantity}</span>
          <button
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= 10}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Guest Checkout Form */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Seus dados</h3>
        <div>
          <Label htmlFor="name" className="text-sm">Nome completo</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Seu nome"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email" className="text-sm">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="seu@email.com"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="cpf" className="text-sm">CPF</Label>
          <Input
            id="cpf"
            name="cpf"
            value={formData.cpf}
            onChange={handleCPFChange}
            placeholder="000.000.000-00"
            className="mt-1"
          />
        </div>
      </div>

      {/* Payment Method */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Pagamento</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setPaymentMethod("pix"); setPixGenerated(false); }}
            className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
              paymentMethod === "pix"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <QrCode className={`h-5 w-5 ${paymentMethod === "pix" ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-sm font-medium ${paymentMethod === "pix" ? "text-primary" : "text-foreground"}`}>
              PIX
            </span>
          </button>
          <button
            onClick={() => setPaymentMethod("card")}
            className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
              paymentMethod === "card"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <CreditCard className={`h-5 w-5 ${paymentMethod === "card" ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-sm font-medium ${paymentMethod === "card" ? "text-primary" : "text-foreground"}`}>
              Cartão
            </span>
          </button>
        </div>

        {/* PIX Payment */}
        {paymentMethod === "pix" && (
          <div className="space-y-3 pt-2">
            {!pixGenerated ? (
              <Button
                onClick={handleGeneratePix}
                variant="outline"
                className="w-full"
                disabled={isGeneratingPix || !isFormValid}
              >
                {isGeneratingPix ? (
                  <>
                    <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                    Gerando QR Code...
                  </>
                ) : (
                  "Gerar QR Code PIX"
                )}
              </Button>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-secondary p-4 rounded-xl flex flex-col items-center">
                  <div className="w-32 h-32 bg-foreground rounded-lg flex items-center justify-center mb-3">
                    <div className="grid grid-cols-8 gap-0.5 p-1">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 ${
                            Math.random() > 0.5 ? "bg-background" : "bg-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyPix}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Código PIX
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price Summary */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal ({quantity}x)</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Taxa de serviço (5%)</span>
          <span>{formatCurrency(serviceFee)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-border">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Action Button */}
      <div className="space-y-3">
        {paymentMethod === "pix" ? (
          <Button
            onClick={handleConfirmPayment}
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!pixGenerated}
          >
            Confirmar Pagamento PIX
          </Button>
        ) : (
          <Button
            onClick={handleCardPayment}
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!isFormValid}
          >
            Pagar {formatCurrency(total)}
          </Button>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>Pagamento 100% seguro</span>
        </div>
      </div>
    </div>
  );
}
