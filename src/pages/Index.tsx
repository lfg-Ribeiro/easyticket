import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EventCard } from "@/components/events/EventCard";
import { CategoryFilter } from "@/components/events/CategoryFilter";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Testimonials } from "@/components/home/Testimonials";
import type { Event } from "@/types/event";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<string[]>(["Todos"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          event_date,
          event_time,
          location,
          venue,
          cover_image_url,
          category,
          fee_absorbed,
          ticket_batches (name, price, available_quantity, status, is_active, sort_order)
        `)
        .eq("published", true)
        .is("deleted_at", null)
        .gte("event_date", new Date().toISOString().split('T')[0])
        .order("event_date", { ascending: true });

      if (data) {
        const mapped: Event[] = data.map((e: any) => {
          const batches = e.ticket_batches || [];
          // Prefer the manually activated batch; fallback to first in-stock batch by sort order
          const activeBatch =
            batches.find((b: any) => b.is_active && b.available_quantity > 0) ||
            batches
              .filter((b: any) => b.available_quantity > 0)
              .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
          const activePrice = activeBatch ? Number(activeBatch.price) : (batches.length > 0 ? Math.min(...batches.map((b: any) => Number(b.price))) : 0);
          const totalAvailable = activeBatch ? activeBatch.available_quantity : batches.reduce((sum: number, b: any) => sum + (b.available_quantity || 0), 0);

          return {
            id: e.id,
            title: e.title,
            description: e.description || "",
            date: e.event_date,
            time: e.event_time,
            location: e.location,
            venue: e.venue,
            image: e.cover_image_url || "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
            price: activePrice,
            category: e.category,
            availableTickets: totalAvailable,
            organizer: "",
            activeBatchName: activeBatch?.name,
          };
        });
        setEvents(mapped);

        // Build categories dynamically from the events in the database
        const uniqueCats = Array.from(new Set(mapped.map((e) => e.category).filter(Boolean)));
        setCategories(["Todos", ...uniqueCats]);
      }
      setLoading(false);
    };

    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesCategory = selectedCategory === "Todos" || event.category === selectedCategory;
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, events]);

  return (
    <MainLayout>
      <div className="container py-6">
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Descubra eventos
          </h1>
          <p className="text-muted-foreground text-lg">
            Encontre experiências incríveis perto de você
          </p>
        </section>

        <section className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar eventos, artistas ou locais..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-secondary border-0 text-base placeholder:text-muted-foreground/70"
            />
          </div>
        </section>

        <section className="mb-8">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">
              {selectedCategory === "Todos" ? "Eventos em destaque" : selectedCategory}
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredEvents.length} evento{filteredEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-2xl h-72 animate-pulse" />
              ))}
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">
                Nenhum evento encontrado
              </p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                Tente ajustar sua busca ou filtros
              </p>
            </div>
          )}
        </section>

          <Testimonials />
      </div>
    </MainLayout>
  );
};

export default Index;
