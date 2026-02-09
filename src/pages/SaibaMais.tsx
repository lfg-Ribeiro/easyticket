import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, QrCode, BarChart3, Zap, ArrowRight, MessageCircle } from "lucide-react";

export default function SaibaMais() {
  return (
    <MainLayout>
      <div className="container max-w-5xl py-10 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6 animate-fade-up">
          <Badge variant="secondary" className="text-sm px-4 py-1.5">
            🚀 Plataforma de ingressos
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight">
            Venda ingressos com a{" "}
            <span className="bg-clip-text text-transparent gradient-primary">
              menor taxa do mercado
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Enquanto a concorrência cobra 10% + taxas fixas, a EasyTicket cobra apenas{" "}
            <strong className="text-foreground">5%</strong>. Sem surpresas, sem letras miúdas.
          </p>
          <Button
            size="lg"
            variant="gradient"
            className="text-lg px-8 py-6 shadow-button"
            onClick={() => window.open("https://wa.me/5545920025315", "_blank")}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Quero meu evento na EasyTicket
          </Button>
        </section>

        {/* Pricing Comparison */}
        <section className="space-y-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Compare e economize
            </h2>
            <p className="text-muted-foreground mt-2">
              Veja quanto você perde com a concorrência
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* EasyTicket Card */}
            <div className="relative bg-card rounded-2xl border-2 border-success p-6 space-y-5 shadow-elevated">
              <div className="absolute -top-3 left-6">
                <Badge className="bg-success text-success-foreground px-3 py-1 text-xs font-bold">
                  ✅ Melhor Opção
                </Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">EasyTicket</h3>
                <p className="text-muted-foreground text-sm mt-1">Simples e transparente</p>
              </div>
              <div className="text-center py-4">
                <span className="text-5xl font-extrabold text-success">5%</span>
                <p className="text-muted-foreground text-sm mt-1">por ingresso vendido</p>
              </div>
              <ul className="space-y-3">
                {[
                  "Sem taxa fixa por ingresso",
                  "Sem mensalidade",
                  "Pagamento instantâneo via PIX",
                  "Dashboard completo grátis",
                  "Scanner QR incluso",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Concorrência Card */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5 opacity-75">
              <div className="absolute -top-3 left-6">
                <Badge variant="secondary" className="px-3 py-1 text-xs font-bold">
                  ⚠️ Alto Custo
                </Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-muted-foreground">Concorrência</h3>
                <p className="text-muted-foreground text-sm mt-1">Taxas escondidas</p>
              </div>
              <div className="text-center py-4">
                <span className="text-5xl font-extrabold text-muted-foreground">10%</span>
                <p className="text-muted-foreground text-sm mt-1">+ taxas fixas por ingresso</p>
              </div>
              <ul className="space-y-3">
                {[
                  "Taxa fixa de R$ 2-5 por ingresso",
                  "Mensalidades em planos PRO",
                  "Repasse em até 30 dias",
                  "Dashboard limitado",
                  "Scanner pago à parte",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <X className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Savings Example */}
          <div className="bg-success/5 border border-success/20 rounded-2xl p-6 max-w-3xl mx-auto">
            <h3 className="font-bold text-foreground text-center mb-4">
              💰 Exemplo real: Evento com 500 ingressos a R$ 100
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Receita bruta</p>
                <p className="text-lg font-bold text-foreground">R$ 50.000</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Na concorrência</p>
                <p className="text-lg font-bold text-destructive">-R$ 6.000</p>
                <p className="text-xs text-muted-foreground">10% + taxas</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Na EasyTicket</p>
                <p className="text-lg font-bold text-success">-R$ 2.500</p>
                <p className="text-xs text-muted-foreground">apenas 5%</p>
              </div>
            </div>
            <p className="text-center text-foreground font-bold mt-4 text-lg">
              Você economiza <span className="text-success">R$ 3.500</span> por evento!
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section className="space-y-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Tudo que você precisa, incluso
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: QrCode,
                title: "Scanner QR",
                description: "Validação de ingressos em tempo real direto pelo celular. Sem hardware extra.",
              },
              {
                icon: BarChart3,
                title: "Dashboard Completo",
                description: "Vendas, participantes, receita e relatórios. Tudo em um painel intuitivo.",
              },
              {
                icon: Zap,
                title: "Pagamento Instantâneo",
                description: "Receba via PIX assim que a venda é confirmada. Sem esperar 30 dias.",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="bg-card rounded-2xl p-6 shadow-card border border-border space-y-3 text-center"
              >
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto">
                  <benefit.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-bold text-foreground">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-6 py-10 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Pronto para vender com a menor taxa?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Entre em contato pelo WhatsApp e comece a vender ingressos em minutos.
          </p>
          <Button
            size="lg"
            variant="gradient"
            className="text-lg px-8 py-6 shadow-button"
            onClick={() => window.open("https://wa.me/5545920025315", "_blank")}
          >
            Quero meu evento na EasyTicket
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </section>
      </div>
    </MainLayout>
  );
}
