export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  venue: string;
  image: string;
  price: number;
  category: string;
  availableTickets: number;
  organizer: string;
  activeBatchId?: string;
  activeBatchName?: string;
  showRemainingTickets?: boolean;
}

export interface Ticket {
  id: string;
  eventId: string;
  event: Event;
  quantity: number;
  totalPrice: number;
  purchaseDate: string;
  qrCode: string;
  status: 'valid' | 'used' | 'expired';
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
  available: number;
}
