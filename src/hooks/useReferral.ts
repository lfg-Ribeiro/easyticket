import { useEffect, useState } from "react";
import { fetchAffiliateName } from "@/lib/referral-attach";
import { captureReferralFromUrl, getStoredReferral } from "@/lib/referral";

/**
 * Indicação ativa para um evento: captura ?ref= (ou ?utm_source=) da URL atual, lê a guardada
 * (inclusive de antes de um login/cadastro em /auth) e busca o nome público do comissionado.
 */
export function useReferral(eventId: string) {
  const [code, setCode] = useState<string | null>(() => {
    captureReferralFromUrl(window.location.search, eventId);
    return getStoredReferral(eventId);
  });
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    captureReferralFromUrl(window.location.search, eventId);
    setCode(getStoredReferral(eventId));
  }, [eventId]);

  useEffect(() => {
    if (!code) {
      setName(null);
      return;
    }
    let active = true;
    fetchAffiliateName(eventId, code).then((affiliateName) => {
      if (active) setName(affiliateName);
    });
    return () => {
      active = false;
    };
  }, [eventId, code]);

  return { code, name };
}
