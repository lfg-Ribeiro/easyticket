import { Event, Ticket } from "@/types/event";

export const mockEvents: Event[] = [
  {
    id: "1",
    title: "Festival de Verão 2025",
    description: "O maior festival de música do Brasil com artistas nacionais e internacionais. Uma experiência única com 3 palcos, área gastronômica e muito mais.",
    date: "2025-03-15",
    time: "16:00",
    location: "São Paulo, SP",
    venue: "Parque Ibirapuera",
    image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
    price: 250,
    category: "Música",
    availableTickets: 5000,
    organizer: "Eventos SP"
  },
  {
    id: "2",
    title: "Stand-up Comedy Night",
    description: "Uma noite de risadas com os melhores comediantes do país. Prepare-se para gargalhadas garantidas!",
    date: "2025-02-20",
    time: "21:00",
    location: "Rio de Janeiro, RJ",
    venue: "Teatro Municipal",
    image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=500&fit=crop",
    price: 80,
    category: "Comédia",
    availableTickets: 300,
    organizer: "Riso Produções"
  },
  {
    id: "3",
    title: "Tech Conference Brasil",
    description: "Conferência de tecnologia com palestras sobre IA, blockchain, desenvolvimento web e muito mais.",
    date: "2025-04-10",
    time: "09:00",
    location: "Belo Horizonte, MG",
    venue: "Centro de Convenções",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop",
    price: 350,
    category: "Tecnologia",
    availableTickets: 1000,
    organizer: "TechBR"
  },
  {
    id: "4",
    title: "Show Acústico - MPB",
    description: "Uma noite intimista com clássicos da música popular brasileira em versões acústicas emocionantes.",
    date: "2025-02-28",
    time: "20:00",
    location: "Curitiba, PR",
    venue: "Casa da Música",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=500&fit=crop",
    price: 120,
    category: "Música",
    availableTickets: 200,
    organizer: "Som Brasileiro"
  },
  {
    id: "5",
    title: "Feira Gastronômica",
    description: "Explore sabores de todo o Brasil com mais de 50 expositores, workshops culinários e degustações.",
    date: "2025-03-22",
    time: "11:00",
    location: "Porto Alegre, RS",
    venue: "Parque Farroupilha",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop",
    price: 45,
    category: "Gastronomia",
    availableTickets: 2000,
    organizer: "Sabores do Sul"
  },
  {
    id: "6",
    title: "Peça de Teatro: Hamlet",
    description: "A clássica obra de Shakespeare em uma montagem moderna e impactante com elenco premiado.",
    date: "2025-03-05",
    time: "19:30",
    location: "Salvador, BA",
    venue: "Teatro Castro Alves",
    image: "https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&h=500&fit=crop",
    price: 90,
    category: "Teatro",
    availableTickets: 400,
    organizer: "Cia. Dramática"
  }
];

export const mockTickets: Ticket[] = [
  {
    id: "t1",
    eventId: "1",
    event: mockEvents[0],
    quantity: 2,
    totalPrice: 500,
    purchaseDate: "2025-01-15",
    qrCode: "TICKET-001-2025",
    status: 'valid'
  },
  {
    id: "t2",
    eventId: "4",
    event: mockEvents[3],
    quantity: 1,
    totalPrice: 120,
    purchaseDate: "2025-01-20",
    qrCode: "TICKET-002-2025",
    status: 'valid'
  }
];

export const categories = [
  "Todos",
  "Música",
  "Comédia",
  "Tecnologia",
  "Teatro",
  "Gastronomia",
  "Esportes"
];
