interface FieldErrorProps {
  /** Id do campo; a mensagem recebe `${id}-error` (usado em aria-describedby). */
  id: string;
  message?: string;
}

/** Mensagem de erro logo abaixo de um campo inválido. */
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}
