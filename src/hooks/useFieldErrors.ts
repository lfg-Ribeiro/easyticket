import { useCallback, useState } from "react";
import type { FieldErrors } from "@/lib/validation";

/**
 * Estado de erros por campo.
 * - `setErrors`: define o resultado completo de uma validação (no submit).
 * - `revalidate`: ao digitar, só mexe em campos que já estão com erro; remove o
 *   erro assim que o valor corrigido passa na validação.
 */
export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<FieldErrors<K>>({});

  const revalidate = useCallback((field: K, message: string | undefined) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      if (message) return prev[field] === message ? prev : { ...prev, [field]: message };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  return { errors, setErrors, revalidate, clearErrors };
}
