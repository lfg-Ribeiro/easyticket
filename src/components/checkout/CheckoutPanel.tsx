import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, CreditCard, QrCode, Copy, Check, Shield, Timer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCountdown } from "@/hooks/useCountdown";
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
  const [pixCode, setPixCode] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState("");
  const [pixOrderId, setPixOrderId] = useState("");
  const [pixTransactionId, setPixTransactionId] = useState("");
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const countdown = useCountdown(15 * 60);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
  });
  const [cardData, setCardData] = useState({
    number: "",
    holderName: "",
    expiry: "",
    cvv: "",
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

  const navigateToSuccess = (txn: string, ordId?: string, pmtId?: string) => {
    const params = new URLSearchParams({
      eventId: event.id,
      name: formData.name,
      email: formData.email,
      quantity: quantity.toString(),
      txn,
    });
    if (pmtId || pixPaymentId) params.set("paymentId", pmtId || pixPaymentId);
    if (ordId || pixOrderId) params.set("orderId", ordId || pixOrderId);
    navigate(`/purchase-success?${params.toString()}`);
  };

  const handleGeneratePix = async () => {
    if (!isFormValid) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setIsGeneratingPix(true);
    try {
      // 1. Create order as pending
      const checkoutResult = await createCheckout();
      const orderId = checkoutResult.order?.id;
      const txnId = checkoutResult.transaction_id;
      setPixOrderId(orderId || "");
      setPixTransactionId(txnId || "");

      // 2. Generate PIX via Asaas
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          amount: total,
          customer_cpf: formData.cpf,
          customer_name: formData.name,
        },
      });
      if (error) throw error;
      setPixCode(data.pix_code || "");
      setQrCodeImage(data.qr_code_image || null);
      setPixPaymentId(data.payment_id || "");
      setPixGenerated(true);
      countdown.start();
    } catch {
      toast({ title: "Erro ao gerar PIX", variant: "destructive" });
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleRegeneratePix = async () => {
    setPixGenerated(false);
    setPixCode("");
    setQrCodeImage(null);
    countdown.reset();
    await handleGeneratePix();
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
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
    navigateToSuccess(result.transaction_id, result.order?.id);
  };

  const handleJaPaguei = async () => {
    if (!pixPaymentId) return;
    setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { payment_id: pixPaymentId, order_id: pixOrderId },
      });
      if (error) throw error;
      if (data?.status === "confirmed") {
        toast({ title: "Pagamento confirmado! 🎉" });
        navigateToSuccess(pixTransactionId, pixOrderId, pixPaymentId);
      } else {
        toast({ title: "Pagamento ainda não confirmado. Aguarde alguns instantes.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao verificar pagamento", variant: "destructive" });
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleConfirmPayment = async () => {
    // PIX: order already created, just navigate to success page for polling
    navigateToSuccess(pixTransactionId, pixOrderId, pixPaymentId);
  };

  const formatCardNumber = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 16);
    return nums.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 4);
    if (nums.length >= 3) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return nums;
  };

  const isCardFormValid = isFormValid &&
    cardData.number.replace(/\D/g, "").length >= 13 &&
    cardData.holderName.trim().length > 0 &&
    cardData.expiry.length >= 5 &&
    cardData.cvv.length >= 3;

  const handleCardPayment = async () => {
    if (!isCardFormValid) {
      toast({ title: "Preencha todos os campos do cartão", variant: "destructive" });
      return;
    }
    setStep("processing");
    try {
      // 1. Create order
      const checkoutResult = await createCheckout();
      const orderId = checkoutResult.order?.id;
      const txnId = checkoutResult.transaction_id;

      // 2. Process card payment via Asaas
      const expiryParts = cardData.expiry.split("/");
      const { data, error } = await supabase.functions.invoke("create-card-payment", {
        body: {
          amount: total,
          customer_cpf: formData.cpf,
          customer_name: formData.name,
          customer_email: formData.email,
          holder_name: cardData.holderName,
          number: cardData.number.replace(/\D/g, ""),
          expiry_month: expiryParts[0],
          expiry_year: `20${expiryParts[1]}`,
          ccv: cardData.cvv,
          event_id: event.id,
          quantity,
          buyer_cpf: formData.cpf,
          order_id: orderId,
        },
      });

      if (error) throw error;
      if (data?.confirmed || data?.status === "CONFIRMED" || data?.status === "RECEIVED") {
        toast({ title: "Pagamento aprovado! 🎉" });
        navigateToSuccess(txnId, orderId);
      } else {
        toast({ title: "Pagamento não aprovado. Verifique os dados do cartão.", variant: "destructive" });
        setStep("form");
      }
    } catch {
      setStep("form");
      toast({ title: "Erro ao processar pagamento com cartão", variant: "destructive" });
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

        {/* Card Payment Form */}
        {paymentMethod === "card" && (
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="cardNumber" className="text-sm">Número do Cartão</Label>
              <Input
                id="cardNumber"
                value={cardData.number}
                onChange={(e) => setCardData(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))}
                placeholder="0000 0000 0000 0000"
                className="mt-1"
                maxLength={19}
              />
            </div>
            <div>
              <Label htmlFor="holderName" className="text-sm">Nome no Cartão</Label>
              <Input
                id="holderName"
                value={cardData.holderName}
                onChange={(e) => setCardData(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
                placeholder="NOME COMO NO CARTÃO"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="expiry" className="text-sm">Validade</Label>
                <Input
                  id="expiry"
                  value={cardData.expiry}
                  onChange={(e) => setCardData(prev => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
                  placeholder="MM/AA"
                  className="mt-1"
                  maxLength={5}
                />
              </div>
              <div>
                <Label htmlFor="cvv" className="text-sm">CVV</Label>
                <Input
                  id="cvv"
                  value={cardData.cvv}
                  onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="123"
                  className="mt-1"
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>
          </div>
        )}

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
                {/* Countdown Timer */}
                <div className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-sm font-semibold ${
                  countdown.isExpired
                    ? "bg-destructive/10 text-destructive"
                    : countdown.secondsLeft <= 120
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}>
                  <Timer className="h-4 w-4" />
                  {countdown.isExpired
                    ? "Tempo esgotado! Gere um novo código."
                    : `Reservado por ${countdown.formatted}. Complete o pagamento.`
                  }
                </div>

                <div className="bg-secondary p-4 rounded-xl flex flex-col items-center">
                  <div className={`w-40 h-40 rounded-lg flex items-center justify-center mb-3 transition-all duration-500 ${
                    countdown.isExpired ? "blur-md opacity-50" : ""
                  }`}>
                    {qrCodeImage ? (
                      <img src={qrCodeImage} alt="QR Code PIX" className="w-full h-full rounded-lg" />
                    ) : (
                      <div className="w-full h-full bg-foreground rounded-lg flex items-center justify-center">
                        <div className="grid grid-cols-8 gap-0.5 p-1">
                          {Array.from({ length: 64 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 ${i % 3 === 0 || i % 7 === 0 ? "bg-background" : "bg-foreground"}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {countdown.isExpired ? (
                    <Button
                      onClick={handleRegeneratePix}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Gerar Novo Código
                    </Button>
                  ) : (
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
                  )}
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
          <>
            <Button
              onClick={handleConfirmPayment}
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!pixGenerated || countdown.isExpired}
            >
              Confirmar Pagamento PIX
            </Button>
            {pixGenerated && !countdown.isExpired && (
              <Button
                onClick={handleJaPaguei}
                variant="outline"
                size="lg"
                className="w-full gap-2"
                disabled={isCheckingPayment}
              >
                {isCheckingPayment ? (
                  <>
                    <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Já fiz o pagamento"
                )}
              </Button>
            )}
          </>
        ) : (
          <Button
            onClick={handleCardPayment}
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!isCardFormValid}
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
