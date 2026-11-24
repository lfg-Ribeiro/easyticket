/** <head> padrão do index.html (valores a que o usePageMeta deve voltar ao desmontar). */
export const DEFAULT_TITLE = "EasyTicket — Ingressos digitais para festas, shows e eventos";
export const DEFAULT_DESCRIPTION = "Compre ingressos para festas, shows e eventos com checkout rápido via PIX ou cartão e receba seu ingresso digital com QR Code na hora.";
export const DEFAULT_OG_IMAGE = "https://www.easyticket.dev.br/og-image.png";

export function resetHead() {
  document.head.innerHTML = `
    <meta charset="UTF-8" />
    <title>${DEFAULT_TITLE}</title>
    <meta name="description" content="${DEFAULT_DESCRIPTION}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="EasyTicket" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:url" content="https://www.easyticket.dev.br/" />
    <meta property="og:title" content="${DEFAULT_TITLE}" />
    <meta property="og:description" content="${DEFAULT_DESCRIPTION}" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${DEFAULT_TITLE}" />
    <meta name="twitter:description" content="${DEFAULT_DESCRIPTION}" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
  `;
}

export const meta = (selector: string) =>
  document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
export const metaContent = (selector: string) => meta(selector)?.getAttribute("content") ?? null;
export const canonicalHref = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
