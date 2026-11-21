/**
 * Validadores de formulário (mensagens em pt-BR).
 * Cada validador devolve a mensagem de erro, ou `undefined` quando o valor é válido.
 */

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** Classes de borda/anel para um campo inválido (Input, Textarea). */
export const ERROR_FIELD_CLASS = "border-destructive focus-visible:ring-destructive";
/** Mesmo para o SelectTrigger, que usa `focus:` em vez de `focus-visible:`. */
export const ERROR_SELECT_CLASS =
  "border-destructive focus:ring-destructive focus-visible:ring-destructive";

/** Aplica `className` de erro apenas quando há mensagem. */
export const errorClass = (message?: string, base = ERROR_FIELD_CLASS) => (message ? base : "");

/** Valor para `aria-describedby`: aponta para a mensagem apenas quando ela existe. */
export const describedBy = (id: string, message?: string) =>
  message ? `${id}-error` : undefined;

/* -------------------------------------------------------------------------- */
/* Texto                                                                       */
/* -------------------------------------------------------------------------- */

export function validateRequired(value: string | null | undefined, message: string) {
  return (value ?? "").trim() ? undefined : message;
}

/** Nome e sobrenome: pelo menos duas palavras com 2+ letras, sem números. */
export function validateFullName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "Informe seu nome completo";
  if (/\d/.test(name)) return "O nome não pode conter números";
  if (name.length > 100) return "Nome muito longo (máx. 100 caracteres)";
  const words = name
    .split(/\s+/)
    .filter((word) => word.replace(/[^\p{L}]/gu, "").length >= 2);
  if (words.length < 2) return "Informe nome e sobrenome";
  return undefined;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Informe seu e-mail";
  if (!isValidEmail(value)) return "Informe um e-mail válido, como nome@email.com";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* CPF                                                                         */
/* -------------------------------------------------------------------------- */

/** CPF com 11 dígitos, não repetidos, e dígitos verificadores corretos. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
}

export function validateCpf(value: string, { required = true } = {}): string | undefined {
  const digits = onlyDigits(value);
  if (!digits) return required ? "Informe seu CPF" : undefined;
  if (digits.length !== 11) return "O CPF deve ter 11 dígitos";
  if (!isValidCpf(digits)) return "CPF inválido. Confira os números digitados";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Telefone                                                                    */
/* -------------------------------------------------------------------------- */

/** Máscara (11) 99999-9999 — mesma usada em Auth/Perfil. */
export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Telefone com DDD: 10 ou 11 dígitos, DDD entre 11 e 99. */
export function validatePhone(value: string, { required = true } = {}): string | undefined {
  const digits = onlyDigits(value);
  if (!digits) return required ? "Informe seu telefone" : undefined;
  if (digits.length < 10 || digits.length > 11) {
    return "Informe o telefone com DDD (10 ou 11 dígitos)";
  }
  if (Number(digits.slice(0, 2)) < 11) return "DDD inválido";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Senha                                                                       */
/* -------------------------------------------------------------------------- */

export const MIN_PASSWORD_LENGTH = 6;

export function validatePassword(value: string, { checkLength = true } = {}): string | undefined {
  if (!value) return "Informe sua senha";
  if (checkLength && value.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  return undefined;
}

/** Senha nova (troca de senha): mesma regra de tamanho, com mensagem de campo vazio própria. */
export function validateNewPassword(value: string): string | undefined {
  return value ? validatePassword(value) : "Informe a nova senha";
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  if (!confirmation) return "Confirme a nova senha";
  if (password !== confirmation) return "As senhas não conferem";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Cartão de crédito                                                           */
/* -------------------------------------------------------------------------- */

export function validateCardNumber(value: string): string | undefined {
  const digits = onlyDigits(value);
  if (!digits) return "Informe o número do cartão";
  if (digits.length < 13 || digits.length > 19) return "Número do cartão inválido";
  return undefined;
}

export function validateCardHolder(value: string): string | undefined {
  return value.trim() ? undefined : "Informe o nome impresso no cartão";
}

/** Validade no formato MM/AA, com mês 01–12 e ainda não vencida. */
export function validateCardExpiry(value: string, now = new Date()): string | undefined {
  if (!value.trim()) return "Informe a validade";
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return "Use o formato MM/AA";
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return "Mês inválido";
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return "Cartão vencido";
  }
  return undefined;
}

export function validateCardCvv(value: string): string | undefined {
  const digits = onlyDigits(value);
  if (!digits) return "Informe o CVV";
  if (digits.length < 3) return "O CVV tem 3 ou 4 dígitos";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Agregadores                                                                 */
/* -------------------------------------------------------------------------- */

/** Remove entradas `undefined`, deixando só os campos realmente inválidos. */
export function compact<K extends string>(
  errors: Partial<Record<K, string | undefined>>,
): FieldErrors<K> {
  const result: FieldErrors<K> = {};
  (Object.keys(errors) as K[]).forEach((key) => {
    const message = errors[key];
    if (message) result[key] = message;
  });
  return result;
}

export interface BuyerValues {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

export type BuyerField = keyof BuyerValues;

export const buyerValidators: Record<BuyerField, (value: string) => string | undefined> = {
  name: validateFullName,
  email: validateEmail,
  cpf: (value) => validateCpf(value),
  phone: (value) => validatePhone(value),
};

export function validateBuyer(values: BuyerValues): FieldErrors<BuyerField> {
  return compact({
    name: buyerValidators.name(values.name),
    email: buyerValidators.email(values.email),
    cpf: buyerValidators.cpf(values.cpf),
    phone: buyerValidators.phone(values.phone),
  });
}

export interface CardValues {
  number: string;
  holderName: string;
  expiry: string;
  cvv: string;
}

export type CardField = "cardNumber" | "holderName" | "expiry" | "cvv";

export const cardValidators: Record<CardField, (values: CardValues) => string | undefined> = {
  cardNumber: (v) => validateCardNumber(v.number),
  holderName: (v) => validateCardHolder(v.holderName),
  expiry: (v) => validateCardExpiry(v.expiry),
  cvv: (v) => validateCardCvv(v.cvv),
};

export function validateCard(values: CardValues): FieldErrors<CardField> {
  return compact({
    cardNumber: cardValidators.cardNumber(values),
    holderName: cardValidators.holderName(values),
    expiry: cardValidators.expiry(values),
    cvv: cardValidators.cvv(values),
  });
}

/* -------------------------------------------------------------------------- */
/* Lotes de ingresso                                                           */
/* -------------------------------------------------------------------------- */

export type BatchField = "name" | "price" | "quantity";
export type BatchErrors = FieldErrors<BatchField>;

export function validateBatchName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "Informe o nome do lote";
  if (name.length > 60) return "Nome muito longo (máx. 60 caracteres)";
  return undefined;
}

export function validateBatchPrice(value: string): string | undefined {
  if (value.trim() === "") return "Informe o preço (use 0 para ingresso gratuito)";
  const price = Number(value);
  if (!Number.isFinite(price)) return "Preço inválido";
  if (price < 0) return "O preço não pode ser negativo";
  return undefined;
}

/** `minimum` permite exigir, na edição, um total maior ou igual ao já vendido. */
export function validateBatchQuantity(value: string, minimum = 1): string | undefined {
  if (value.trim() === "") return "Informe a quantidade";
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) return "Use um número inteiro";
  if (quantity < 1) return "A quantidade mínima é 1";
  if (quantity < minimum) {
    return `Já foram vendidos ${minimum} ingressos neste lote; a quantidade não pode ser menor`;
  }
  return undefined;
}

export function validateBatch(
  batch: { name: string; price: string; quantity: string },
  minimumQuantity = 1,
): BatchErrors {
  return compact({
    name: validateBatchName(batch.name),
    price: validateBatchPrice(batch.price),
    quantity: validateBatchQuantity(batch.quantity, minimumQuantity),
  });
}

/* -------------------------------------------------------------------------- */
/* Evento                                                                      */
/* -------------------------------------------------------------------------- */

export type EventField = "title" | "category" | "date" | "time" | "location";

export interface EventBasics {
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
}

export const eventValidators: Record<EventField, (values: EventBasics) => string | undefined> = {
  title: (v) => {
    if (!v.title.trim()) return "Informe o nome do evento";
    if (v.title.trim().length > 150) return "Nome muito longo (máx. 150 caracteres)";
    return undefined;
  },
  category: (v) => (v.category ? undefined : "Selecione uma categoria"),
  date: (v) => (v.date ? undefined : "Informe a data do evento"),
  time: (v) => (v.time ? undefined : "Informe o horário de início"),
  location: (v) => validateRequired(v.location, "Informe o local do evento"),
};

export function validateEventBasics(values: EventBasics): FieldErrors<EventField> {
  return compact({
    title: eventValidators.title(values),
    category: eventValidators.category(values),
    date: eventValidators.date(values),
    time: eventValidators.time(values),
    location: eventValidators.location(values),
  });
}

export interface BatchRowInput {
  /** Identificador estável da linha (id do lote ou chave local de um lote novo). */
  key: string;
  name: string;
  price: string;
  quantity: string;
  /** Na edição: ingressos já vendidos; a quantidade total não pode ficar abaixo disso. */
  minimumQuantity?: number;
}

export interface BatchRowsValidation {
  rowErrors: Record<string, BatchErrors>;
  /** Erro que não pertence a nenhuma linha (ex.: nenhum lote cadastrado). */
  general?: string;
}

export function validateBatchRows(
  rows: BatchRowInput[],
  { requireAtLeastOne = true } = {},
): BatchRowsValidation {
  const rowErrors: Record<string, BatchErrors> = {};
  rows.forEach((row) => {
    const errors = validateBatch(row, row.minimumQuantity ?? 1);
    if (Object.keys(errors).length > 0) rowErrors[row.key] = errors;
  });
  const general =
    requireAtLeastOne && rows.length === 0 ? "Adicione pelo menos um lote de ingressos" : undefined;
  return { rowErrors, general };
}

/** Atualiza o erro de um campo de uma linha de lote (só se ela já estava com erro). */
export function updateBatchFieldError(
  prev: Record<string, BatchErrors>,
  key: string,
  field: BatchField,
  message: string | undefined,
): Record<string, BatchErrors> {
  const row = prev[key];
  if (!row?.[field]) return prev;
  const nextRow = { ...row };
  if (message) nextRow[field] = message;
  else delete nextRow[field];
  const next = { ...prev };
  if (Object.keys(nextRow).length > 0) next[key] = nextRow;
  else delete next[key];
  return next;
}

/* -------------------------------------------------------------------------- */
/* Cortesias                                                                   */
/* -------------------------------------------------------------------------- */

export const COURTESY_MAX_QUANTITY = 20;

/** Máscara 000.000.000-00 */
export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function validateCourtesyQuantity(value: string): string | undefined {
  if (value.trim() === "") return "Informe a quantidade";
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) return "Use um número inteiro";
  if (quantity < 1) return "A quantidade mínima é 1";
  if (quantity > COURTESY_MAX_QUANTITY) return `A quantidade máxima é ${COURTESY_MAX_QUANTITY}`;
  return undefined;
}

export type CourtesyField = "event" | "name" | "email" | "cpf" | "quantity";

export interface CourtesyValues {
  eventId: string;
  name: string;
  email: string;
  cpf: string;
  quantity: string;
}

export const courtesyValidators: Record<CourtesyField, (values: CourtesyValues) => string | undefined> = {
  event: (v) => (v.eventId ? undefined : "Escolha o evento da cortesia"),
  name: (v) => validateFullName(v.name),
  email: (v) => validateEmail(v.email),
  cpf: (v) => validateCpf(v.cpf),
  quantity: (v) => validateCourtesyQuantity(v.quantity),
};

export function validateCourtesy(values: CourtesyValues): FieldErrors<CourtesyField> {
  return compact({
    event: courtesyValidators.event(values),
    name: courtesyValidators.name(values),
    email: courtesyValidators.email(values),
    cpf: courtesyValidators.cpf(values),
    quantity: courtesyValidators.quantity(values),
  });
}

/* -------------------------------------------------------------------------- */
/* Comissionados / Atléticas                                                   */
/* -------------------------------------------------------------------------- */

export type AffiliateField = "name" | "refCode" | "commission";

export interface AffiliateValues {
  name: string;
  refCode: string;
  commission: string;
}

export function validateAffiliateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "Informe o nome da atlética ou do comissionado";
  if (name.length < 2) return "O nome deve ter pelo menos 2 caracteres";
  if (name.length > 100) return "Nome muito longo (máx. 100 caracteres)";
  return undefined;
}

/** Código do link: minúsculas, números e "_" (2 a 64 caracteres). */
export function validateRefCode(value: string): string | undefined {
  const code = value.trim();
  if (!code) return "Informe o código do link";
  if (!/^[a-z0-9_]+$/.test(code)) return "Use apenas letras minúsculas, números e _ (sem acentos ou espaços)";
  if (code.length < 2) return "O código deve ter pelo menos 2 caracteres";
  if (code.length > 64) return "Código muito longo (máx. 64 caracteres)";
  return undefined;
}

/** Comissão opcional: vazio = 0%. Aceita vírgula ou ponto, de 0 a 100 com até 2 casas. */
export function validateCommissionPercent(value: string): string | undefined {
  const text = value.trim().replace(",", ".");
  if (text === "") return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "Informe um percentual válido, como 10 ou 7,5";
  const percent = Number(text);
  if (percent < 0 || percent > 100) return "A comissão deve ficar entre 0% e 100%";
  return undefined;
}

export const affiliateValidators: Record<AffiliateField, (values: AffiliateValues) => string | undefined> = {
  name: (v) => validateAffiliateName(v.name),
  refCode: (v) => validateRefCode(v.refCode),
  commission: (v) => validateCommissionPercent(v.commission),
};

export function validateAffiliate(values: AffiliateValues): FieldErrors<AffiliateField> {
  return compact({
    name: affiliateValidators.name(values),
    refCode: affiliateValidators.refCode(values),
    commission: affiliateValidators.commission(values),
  });
}

/** "7,5" -> 7.5; vazio -> 0 */
export const parseCommissionPercent = (value: string) => Number(value.trim().replace(",", ".") || "0");

/* -------------------------------------------------------------------------- */
/* Foco no primeiro campo inválido                                             */
/* -------------------------------------------------------------------------- */

/**
 * Rola até o primeiro elemento com `aria-invalid="true"` dentro de `root`
 * (ordem do DOM = ordem visual) e dá foco nele. Roda após a renderização para
 * que os `aria-invalid` já estejam aplicados; vale para dialogs, drawers e páginas.
 */
export function focusFirstInvalid(root: ParentNode | null | undefined, attempts = 3) {
  if (typeof window === "undefined" || !root) return;

  window.requestAnimationFrame(() => {
    const element = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!element) {
      if (attempts > 1) window.setTimeout(() => focusFirstInvalid(root, attempts - 1), 50);
      return;
    }
    element.scrollIntoView?.({ behavior: "smooth", block: "center" });
    element.focus({ preventScroll: true });
  });
}
