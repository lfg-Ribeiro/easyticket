import { useEffect } from "react";
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_NAME,
  absoluteUrl,
  cleanCanonicalUrl,
  getSiteOrigin,
} from "@/lib/seo";

export interface PageMeta {
  /** Título completo da aba (ex.: "Meus Ingressos | EasyTicket"). */
  title?: string;
  description?: string;
  /** Imagem de compartilhamento (URL absoluta ou caminho a partir da raiz). */
  image?: string;
  /** Endereço público da página; por padrão, a URL atual sem parâmetros de rastreamento. */
  url?: string;
  type?: string;
  /** Páginas privadas/transacionais: pede aos buscadores para não indexar. */
  noindex?: boolean;
}

type Restore = () => void;

const MARK = "data-page-meta";
const head = () => document.head;

/** Cria ou atualiza uma <meta>; devolve a função que restaura o valor anterior (ou remove a criada). */
function setMeta(attr: "name" | "property", key: string, content: string): Restore {
  const existing = head().querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (existing) {
    const previous = existing.getAttribute("content");
    existing.setAttribute("content", content);
    return () => {
      if (previous === null) existing.removeAttribute("content");
      else existing.setAttribute("content", previous);
    };
  }
  const created = document.createElement("meta");
  created.setAttribute(attr, key);
  created.setAttribute("content", content);
  created.setAttribute(MARK, "true");
  head().appendChild(created);
  return () => created.remove();
}

function setCanonical(href: string): Restore {
  const existing = head().querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (existing) {
    const previous = existing.getAttribute("href");
    existing.setAttribute("href", href);
    return () => {
      if (previous === null) existing.removeAttribute("href");
      else existing.setAttribute("href", previous);
    };
  }
  const created = document.createElement("link");
  created.setAttribute("rel", "canonical");
  created.setAttribute("href", href);
  created.setAttribute(MARK, "true");
  head().appendChild(created);
  return () => created.remove();
}

/** Remove uma <meta> existente e a recoloca no mesmo lugar ao restaurar. */
function removeMeta(property: string): Restore {
  const existing = head().querySelector(`meta[property="${property}"]`);
  if (!existing) return () => {};
  const parent = existing.parentNode;
  const next = existing.nextSibling;
  existing.remove();
  return () => {
    if (parent && !existing.isConnected) parent.insertBefore(existing, next);
  };
}

/**
 * Aplica título, descrição, Open Graph, Twitter Card, canonical e robots no <head>.
 * Devolve a função que desfaz tudo (restaura os valores padrão do index.html).
 */
export function applyPageMeta(meta: PageMeta): Restore {
  const restores: Restore[] = [];
  const origin = getSiteOrigin();

  if (meta.title !== undefined) {
    const previousTitle = document.title;
    document.title = meta.title;
    restores.push(() => {
      document.title = previousTitle;
    });
    restores.push(setMeta("property", "og:title", meta.title));
    restores.push(setMeta("name", "twitter:title", meta.title));
  }

  if (meta.description !== undefined) {
    restores.push(setMeta("name", "description", meta.description));
    restores.push(setMeta("property", "og:description", meta.description));
    restores.push(setMeta("name", "twitter:description", meta.description));
  }

  if (meta.image !== undefined) {
    const image = absoluteUrl(meta.image, origin);
    restores.push(setMeta("property", "og:image", image));
    restores.push(setMeta("name", "twitter:image", image));
    // 1200x630 é a medida da imagem padrão: para outras imagens, não declaramos dimensões
    if (image !== absoluteUrl(DEFAULT_OG_IMAGE_PATH, origin)) {
      restores.push(removeMeta("og:image:width"));
      restores.push(removeMeta("og:image:height"));
    }
  }

  const canonical = cleanCanonicalUrl(meta.url ?? `${window.location.pathname}${window.location.search}`, origin);
  if (meta.title !== undefined || meta.description !== undefined || meta.url !== undefined) {
    restores.push(setCanonical(canonical));
    restores.push(setMeta("property", "og:url", canonical));
  }

  if (meta.title !== undefined || meta.description !== undefined) {
    restores.push(setMeta("property", "og:type", meta.type ?? "website"));
    restores.push(setMeta("property", "og:site_name", SITE_NAME));
    restores.push(setMeta("property", "og:locale", "pt_BR"));
    restores.push(setMeta("name", "twitter:card", "summary_large_image"));
  }

  if (meta.noindex) {
    restores.push(setMeta("name", "robots", "noindex, nofollow"));
  }

  return () => {
    // desfaz na ordem inversa, devolvendo o <head> ao estado anterior
    for (let i = restores.length - 1; i >= 0; i--) restores[i]();
  };
}

/**
 * Define as meta tags da página enquanto ela está montada e restaura os padrões ao desmontar.
 * Aceita `{}` (nada a aplicar), útil enquanto os dados da página ainda carregam.
 */
export function usePageMeta(meta: PageMeta) {
  const key = JSON.stringify(meta);
  useEffect(() => applyPageMeta(JSON.parse(key) as PageMeta), [key]);
}
