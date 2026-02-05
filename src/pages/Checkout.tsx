import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Shield, Check, Info } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockEvents } from "@/data/mockEvents";
import { toast } from "@/hooks/use-toast";

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quantity = parseInt(searchParams.get("quantity") || "1", 10);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  });

  const event = mockEvents.find((e) => e.id === id);

  if (!event) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Evento não encontrado</h1>
          <Button onClick={() => navigate("/")}>Voltar aos eventos</Button>
        </div>
      </MainLayout>
    );
  }

  const subtotal = event.price * quantity;
  const serviceFee = subtotal * 0.05; // 5% taxa de serviço
  const total = subtotal + serviceFee;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simular processamento de pagamento
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: "Compra realizada com sucesso! 🎉",
      description: "Seus ingressos já estão disponíveis na sua conta.",
    });

    navigate("/tickets");
  };

  return (
    <MainLayout>
      <div className="container py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Finalizar compra</h1>
            <p className="text-sm text-muted-foreground">Pagamento seguro</p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-card rounded-2xl shadow-card p-5 mb-6">
          <div className="flex gap-4 mb-4">
            <img
              src={event.image}
              alt={event.title}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground line-clamp-2">{event.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {quantity} ingresso{quantity > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                Taxa de serviço (5%)
                <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
              </span>
              <span className="text-foreground">{formatCurrency(serviceFee)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <div className="bg-card rounded-2xl shadow-card p-5">
            <h2 className="font-semibold text-foreground mb-4">Dados pessoais</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Seu nome"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="seu@email.com"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  placeholder="000.000.000-00"
                  required
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          {/* Card Info */}
          <div className="bg-card rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Cartão de crédito</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cardNumber">Número do cartão</Label>
                <Input
                  id="cardNumber"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleInputChange}
                  placeholder="0000 0000 0000 0000"
                  required
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cardExpiry">Validade</Label>
                  <Input
                    id="cardExpiry"
                    name="cardExpiry"
                    value={formData.cardExpiry}
                    onChange={handleInputChange}
                    placeholder="MM/AA"
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="cardCvv">CVV</Label>
                  <Input
                    id="cardCvv"
                    name="cardCvv"
                    value={formData.cardCvv}
                    onChange={handleInputChange}
                    placeholder="123"
                    required
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Pagamento 100% seguro e criptografado</span>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="xl"
            variant="gradient"
            className="w-full"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Processando...
              </span>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Pagar {formatCurrency(total)}
              </>
            )}
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}
