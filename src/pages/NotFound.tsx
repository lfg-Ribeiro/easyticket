import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, Home, Ticket } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { pageTitle } from "@/lib/seo";

const MAX_PATH_LENGTH = 60;

const NotFound = () => {
  usePageMeta({
    title: pageTitle("Página não encontrada"),
    description: "O link que você acessou pode ter expirado ou o evento não está mais disponível.",
    noindex: true,
  });

  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const shownPath =
    location.pathname.length > MAX_PATH_LENGTH
      ? `${location.pathname.slice(0, MAX_PATH_LENGTH)}…`
      : location.pathname;

  return (
    <MainLayout>
      <div className="container flex min-h-[calc(100dvh-10rem)] max-w-xl items-center justify-center py-12">
        <section aria-labelledby="not-found-title" className="w-full animate-fade-up text-center">
          {/* Ingresso "rasgado": canhoto com bússola + 404 */}
          <div
            aria-hidden="true"
            className="relative mx-auto mb-8 flex h-40 w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-elevated"
          >
            <div className="gradient-primary flex w-28 flex-shrink-0 flex-col items-center justify-center gap-2 text-primary-foreground">
              <Compass className="h-10 w-10" strokeWidth={1.75} />
              <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                EasyTicket
              </span>
            </div>

            <div className="relative flex w-0 flex-col items-center justify-center">
              <div className="absolute -top-4 z-10 h-8 w-8 rounded-full bg-background" />
              <div className="h-full border-l-2 border-dashed border-border" />
              <div className="absolute -bottom-4 z-10 h-8 w-8 rounded-full bg-background" />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-4">
              <span className="gradient-primary bg-clip-text text-6xl font-extrabold leading-none text-transparent">
                404
              </span>
              <span className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ingresso não encontrado
              </span>
            </div>
          </div>

          <h1 id="not-found-title" className="text-2xl font-bold text-foreground md:text-3xl">
            Página não encontrada
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            O link que você acessou pode ter expirado ou o evento não está mais disponível.
            Que tal explorar os eventos que estão acontecendo agora?
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Endereço acessado:{" "}
            <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono">{shownPath}</code>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="gradient" size="lg">
              <Link to="/">
                <Home />
                Explorar eventos
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/tickets">
                <Ticket />
                Meus ingressos
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default NotFound;
