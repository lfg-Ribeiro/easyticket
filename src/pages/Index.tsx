import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EventCard } from "@/components/events/EventCard";
import { CategoryFilter } from "@/components/events/CategoryFilter";
import { mockEvents, categories } from "@/data/mockEvents";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/types/event";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [dbEvents, setDbEvents] = useState<Event[]>([]);

  // Fetch real events from database
  useEffect(() => {
    const fetchEvents = async () => {
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
          fee_absorbed
        `)
        .eq("published", true)
        .order("event_date", { ascending: true });

      if (data) {
        const mapped: Event[] = data.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description || "",
          date: e.event_date,
          time: e.event_time,
          location: e.location,
          venue: e.venue,
          image: e.cover_image_url || "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
          price: 0,
          category: e.category,
          availableTickets: 0,
          organizer: "",
        }));
        setDbEvents(mapped);
      }
    };

    fetchEvents();
  }, []);

  // Combine mock events + DB events (DB first)
  const allEvents = useMemo(() => {
    const mockIds = new Set(mockEvents.map((e) => e.id));
    const dbFiltered = dbEvents.filter((e) => !mockIds.has(e.id));
    return [...dbFiltered, ...mockEvents];
  }, [dbEvents]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      const matchesCategory = selectedCategory === "Todos" || event.category === selectedCategory;
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, allEvents]);

  return (
    <MainLayout>
      <div className="container py-6">
        {/* Hero Section */}
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Descubra eventos
          </h1>
          <p className="text-muted-foreground text-lg">
            Encontre experiências incríveis perto de você
          </p>
        </section>

        {/* Search */}
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

        {/* Categories */}
        <section className="mb-8">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </section>

        {/* Events Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">
              {selectedCategory === "Todos" ? "Eventos em destaque" : selectedCategory}
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredEvents.length} evento{filteredEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredEvents.length > 0 ? (
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
      </div>
    </MainLayout>
  );
};

export default Index;
