// Mock data for organizer dashboard

export interface SalesDataPoint {
  label: string;
  vendas: number;
  receita: number;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  ticketType: string;
  paymentStatus: "confirmado" | "pendente" | "reembolsado";
  purchaseDate: string;
}

export const salesLast7Days: SalesDataPoint[] = [
  { label: "Seg", vendas: 12, receita: 3000 },
  { label: "Ter", vendas: 18, receita: 4500 },
  { label: "Qua", vendas: 8, receita: 2000 },
  { label: "Qui", vendas: 24, receita: 6000 },
  { label: "Sex", vendas: 31, receita: 7750 },
  { label: "Sáb", vendas: 42, receita: 10500 },
  { label: "Dom", vendas: 21, receita: 5250 },
];

export const salesLast24h: SalesDataPoint[] = [
  { label: "00h", vendas: 1, receita: 250 },
  { label: "03h", vendas: 0, receita: 0 },
  { label: "06h", vendas: 2, receita: 500 },
  { label: "09h", vendas: 5, receita: 1250 },
  { label: "12h", vendas: 8, receita: 2000 },
  { label: "15h", vendas: 12, receita: 3000 },
  { label: "18h", vendas: 15, receita: 3750 },
  { label: "21h", vendas: 9, receita: 2250 },
];

export const mockParticipants: Participant[] = [
  { id: "p1", name: "Ana Silva", email: "ana.silva@email.com", ticketType: "Pista", paymentStatus: "confirmado", purchaseDate: "2025-01-28" },
  { id: "p2", name: "Carlos Oliveira", email: "carlos.o@email.com", ticketType: "VIP", paymentStatus: "confirmado", purchaseDate: "2025-01-27" },
  { id: "p3", name: "Beatriz Santos", email: "bia.santos@email.com", ticketType: "Pista", paymentStatus: "pendente", purchaseDate: "2025-01-27" },
  { id: "p4", name: "Diego Ferreira", email: "diego.f@email.com", ticketType: "Camarote", paymentStatus: "confirmado", purchaseDate: "2025-01-26" },
  { id: "p5", name: "Fernanda Lima", email: "fer.lima@email.com", ticketType: "Pista", paymentStatus: "confirmado", purchaseDate: "2025-01-26" },
  { id: "p6", name: "Gabriel Costa", email: "gab.costa@email.com", ticketType: "VIP", paymentStatus: "reembolsado", purchaseDate: "2025-01-25" },
  { id: "p7", name: "Helena Rocha", email: "helena.r@email.com", ticketType: "Pista", paymentStatus: "confirmado", purchaseDate: "2025-01-25" },
  { id: "p8", name: "Igor Mendes", email: "igor.m@email.com", ticketType: "Pista", paymentStatus: "confirmado", purchaseDate: "2025-01-24" },
];
