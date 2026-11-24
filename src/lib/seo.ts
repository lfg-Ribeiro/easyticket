import { formatEventDate } from "@/lib/utils";
import { formatBRL } from "@/lib/purchase";
import type { PageMeta } from "@/hooks/usePageMeta";

export const SITE_NAME = "EasyTicket";
/** Endereço canônico do site em produção (www). */
export const PRODUCTION_ORIGIN = "https://www.easyticket.dev.br";
const PRODUCTION_HOSTS = ["easyticket.dev.br", "www.easyticket.dev.br"];
export const DEFAULT_OG_IMAGE_PATH = "/og-image.png";

export const HOME_TITLE = "EasyTicket — Ingressos digitais para festas, shows e eventos";
export const HOME_DESCRIPTION =
  "Compre ingressos para festas, shows e eventos com checkout rápido via PIX ou cartão e receba seu ingresso digital com QR Code na hora.";

/** Capa usada pela página do evento quando ele não tem imagem própria (não serve como imagem de compartilhamento). */
export const EVENT_FALLBACK_COVER =
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop";

/** "Meus Ingressos" -> "Meus Ingressos | EasyTicket" */
export const pageTitle = (name: string) => `${name} | ${SITE_NAME}`;

/**
 * Origem usada em canonical/og:url/og:image. Em produção (easyticket.dev.br ou www) é sempre a
 * versão www, para não existirem dois "canônicos"; em dev/preview, a própria origem.
 */
export function getSiteOrigin(loc: Pick<Location, "hostname" | "origin"> = window.location): string {
  return PRODUCTION_HOSTS.includes(loc.hostname) ? PRODUCTION_ORIGIN : loc.origin;
}

/** Torna absoluta uma URL de imagem/página ("/og-image.png" -> "https://…/og-image.png"). */
export function absoluteUrl(src: string, origin: string = getSiteOrigin()): string {
  try {
    return new URL(src, origin).toString();
  } catch {
    return src;
  }
}

/** Parâmetros de rastreamento: transitórios, não fazem parte do endereço público da página. */
const TRACKING_PARAM = /^(ref|utm_.+|fbclid|gclid|gbraid|wbraid|igshid|msclkid|yclid|ttclid|mc_cid|mc_eid|_ga|_gl)$/i;

/** URL canônica: sem hash e sem parâmetros de rastreamento (?ref=, utm_*, fbclid…), mantendo o caminho. */
export function cleanCanonicalUrl(href: string, origin: string = getSiteOrigin()): string {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return origin;
  }
  [...url.searchParams.keys()].forEach((key) => {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  });
  url.hash = "";
  return url.toString();
}

export interface EventMetaInput {
  id?: string;
  loading: boolean;
  event: {
    title: string;
    date: string;
    venue: string;
    location: string;
    image: string;
    price: number;
  } | null;
}

/** Meta da página do evento: genérica enquanto carrega, noindex se não existir, completa quando carrega. */
export function buildEventMeta({ id, loading, event }: EventMetaInput): PageMeta {
  if (loading) return {};
  if (!event) {
    return { title: pageTitle("Evento não encontrado"), description: "Este evento não está mais disponível.", noindex: true };
  }

  const date = formatEventDate(event.date, { day: "numeric", month: "long", year: "numeric" }, "");
  const place = [event.venue, event.location].filter(Boolean).join(", ");
  const price = event.price > 0 ? ` Ingressos a partir de ${formatBRL(event.price)}.` : "";
  const hasCover = !!event.image && event.image !== EVENT_FALLBACK_COVER;

  return {
    title: `${event.title} — Ingressos | ${SITE_NAME}`,
    description:
      `Garanta seu ingresso para ${event.title}${date ? ` em ${date}` : ""}${place ? ` no ${place}` : ""}.` +
      `${price} Compra rápida e segura no ${SITE_NAME}.`,
    image: hasCover ? event.image : absoluteUrl(DEFAULT_OG_IMAGE_PATH),
    // caminho limpo do evento: nunca carrega ?ref= nem outros parâmetros
    url: id ? `/event/${id}` : undefined,
  };
}
