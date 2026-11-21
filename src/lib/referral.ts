/**
 * Rastreamento de indicações (?ref=) — Roadmap 3.3.
 *
 * O código vem do link de uma atlética/promoter (ex.: /event/<id>?ref=atletica_engenharia),
 * fica guardado no navegador por 7 dias (por evento + um "global" de reserva) e é gravado em
 * orders.referred_by logo após o create-checkout (ver referral-attach.ts).
 */

export const REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_REF_CODE_LENGTH = 64;

const EVENT_KEY_PREFIX = "easyticket:ref:event:";
const GLOBAL_KEY = "easyticket:ref:global";

interface StoredReferral {
  code: string;
  /** Evento da página onde o link foi aberto (ausente quando capturado fora de um evento). */
  eventId?: string;
  savedAt: number;
}

/**
 * Normaliza para um slug: minúsculas, sem acentos, espaços e caracteres especiais viram "_",
 * sem "_" repetidos/nas pontas, no máximo 64 caracteres. "Atlética Eng. Civil" -> "atletica_eng_civil".
 */
export function normalizeRefCode(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_REF_CODE_LENGTH)
    .replace(/_+$/g, "");
}

/** Sugestão de código a partir do nome cadastrado. */
export const suggestRefCode = normalizeRefCode;

/** Link público de indicação para um evento. */
export const buildReferralLink = (
  eventId: string,
  refCode: string,
  origin: string = window.location.origin,
) => `${origin}/event/${eventId}?ref=${encodeURIComponent(refCode)}`;

/** `?ref=` tem prioridade; `?utm_source=` só vale quando `ref` está ausente (ou vazio/inválido). */
export function readRefFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return normalizeRefCode(params.get("ref")) || normalizeRefCode(params.get("utm_source"));
}

/* ------------------------------ armazenamento ------------------------------ */

const storage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // modo privado / storage bloqueado
  }
};

const readEntry = (key: string, now: number): StoredReferral | null => {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredReferral;
    const valid =
      typeof entry?.code === "string" &&
      entry.code !== "" &&
      typeof entry.savedAt === "number" &&
      now - entry.savedAt >= 0 &&
      now - entry.savedAt <= REFERRAL_TTL_MS;
    if (!valid) {
      store.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    store.removeItem(key);
    return null;
  }
};

const writeEntry = (key: string, entry: StoredReferral) => {
  try {
    storage()?.setItem(key, JSON.stringify(entry));
  } catch {
    /* sem espaço / bloqueado: a indicação simplesmente não é guardada */
  }
};

/**
 * Lê ?ref= (ou ?utm_source=) da URL e guarda por 7 dias:
 * por evento (se `eventId` for informado) e como reserva "global".
 * Devolve o código capturado, ou null quando a URL não traz indicação
 * (nesse caso nada é sobrescrito).
 */
export function captureReferralFromUrl(
  search: string,
  eventId?: string,
  now: number = Date.now(),
): string | null {
  const code = readRefFromSearch(search);
  if (!code) return null;

  const entry: StoredReferral = { code, savedAt: now, ...(eventId ? { eventId } : {}) };
  if (eventId) writeEntry(EVENT_KEY_PREFIX + eventId, entry);
  writeEntry(GLOBAL_KEY, entry);
  return code;
}

/**
 * Indicação ativa. Com `eventId`: a guardada para o evento; se não houver, a reserva global —
 * mas só quando ela foi capturada fora de um evento ou no mesmo evento (a indicação de um
 * evento nunca "vaza" para a compra de outro).
 */
export function getStoredReferral(eventId?: string, now: number = Date.now()): string | null {
  if (eventId) {
    const perEvent = readEntry(EVENT_KEY_PREFIX + eventId, now);
    if (perEvent) return perEvent.code;
  }
  const global = readEntry(GLOBAL_KEY, now);
  if (!global) return null;
  if (!eventId || !global.eventId || global.eventId === eventId) return global.code;
  return null;
}

/** Limpa a indicação de um evento (e a reserva global, se for do mesmo evento); sem `eventId`, tudo. */
export function clearStoredReferral(eventId?: string) {
  const store = storage();
  if (!store) return;
  try {
    if (!eventId) {
      Object.keys(store)
        .filter((key) => key.startsWith(EVENT_KEY_PREFIX))
        .forEach((key) => store.removeItem(key));
      store.removeItem(GLOBAL_KEY);
      return;
    }
    store.removeItem(EVENT_KEY_PREFIX + eventId);
    const global = readEntry(GLOBAL_KEY, Date.now());
    if (global && (!global.eventId || global.eventId === eventId)) store.removeItem(GLOBAL_KEY);
  } catch {
    /* ignore */
  }
}
