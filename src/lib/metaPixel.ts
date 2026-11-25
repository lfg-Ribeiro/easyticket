// Meta Pixel loader: only injected when the current event has a pixel id.
type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

const initialized = new Set<string>();
let activePixel: string | null = null;

function loadScript() {
  if (window.fbq) return;
  const n: Fbq = function (...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n as any).callMethod ? (n as any).callMethod(...args) : n.queue!.push(args);
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
  window._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
}

export function initMetaPixel(pixelId?: string | null): boolean {
  const id = (pixelId || "").trim();
  if (!id || !/^\d+$/.test(id) || typeof window === "undefined") return false;
  loadScript();
  if (!initialized.has(id)) {
    window.fbq!("init", id);
    initialized.add(id);
  }
  activePixel = id;
  return true;
}

export function newMetaEventId(): string {
  return crypto.randomUUID();
}

export function trackMetaEvent(name: "ViewContent" | "InitiateCheckout" | "PageView", data: Record<string, unknown> = {}, eventId = newMetaEventId()) {
  if (!activePixel || !window.fbq) return;
  window.fbq("trackSingle", activePixel, name, data, { eventID: eventId });
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Meta browser ids (_fbp/_fbc) for CAPI matching; builds fbc from ?fbclid when the cookie is missing. */
export function getMetaBrowserIds(): { meta_fbp: string | null; meta_fbc: string | null } {
  if (typeof document === "undefined") return { meta_fbp: null, meta_fbc: null };
  let fbc = readCookie("_fbc");
  if (!fbc) {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  }
  return { meta_fbp: readCookie("_fbp"), meta_fbc: fbc };
}
