import { Quote, Star } from "lucide-react";

interface Testimonial {
  name: string;
  eventType: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
}

const TESTIMONIALS: Testimonial[] = [
  /* {
    name: "Vitor Damiati",
    eventType: "Organizador — Dami's Room",
    rating: 5,
    text: "Colocar o Dami's Room no EasyTicket foi sensacional. O painel me deu controle total das vendas em tempo real e a portaria funcionou perfeitamente, sem nenhuma dor de cabeça.",
  }, */
  {
    name: "Gilmar Junior",
    eventType: "Comprador — Pul Pári da Ursanos",
    rating: 5,
    text: "Comprei meu ingresso pra Pul Pári da Ursanos pelo celular em segundos. Super prático, o PIX caiu na hora e a entrada na festa foi super rápida com o QR Code.",
  },
  {
    name: "Pedro Naiuhã",
    eventType: "Comprador — Pul Pári da Ursanos",
    rating: 5,
    text: "Plataforma excelente! Sem burocracia, comprei o ingresso para o evento de casa e entrei na portaria só mostrando o celular. Recomendo demais!",
  },
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5" role="img" aria-label={`Nota ${rating} de 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        aria-hidden="true"
        className={
          n <= rating
            ? "h-4 w-4 fill-yellow-400 text-yellow-400"
            : "h-4 w-4 text-muted-foreground/30"
        }
      />
    ))}
  </div>
);

export const Testimonials = () => (
  <section className="mt-14 mb-6" aria-labelledby="testimonials-title">
    <div className="mb-6 text-center md:text-left">
      <h2 id="testimonials-title" className="text-xl md:text-2xl font-bold text-foreground">
        O que dizem quem usa o EasyTicket
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Produtores e participantes que aprovam nossa experiência de ponta a ponta.
      </p>
    </div>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <figure
          key={t.name}
          className="relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <Quote
            aria-hidden="true"
            className="absolute right-5 top-5 h-8 w-8 text-primary/10"
          />
          <Stars rating={t.rating} />
          <blockquote className="flex-1 text-sm leading-relaxed text-foreground/90">
            “{t.text}”
          </blockquote>
          <figcaption className="flex items-center gap-3 border-t border-border pt-4">
            <div
              aria-hidden="true"
              className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground"
            >
              {getInitials(t.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
              <span className="mt-0.5 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                {t.eventType}
              </span>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  </section>
);