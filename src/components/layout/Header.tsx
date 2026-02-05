import { Link, useLocation } from "react-router-dom";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Eventos" },
  { to: "/tickets", label: "Meus Ingressos" },
  { to: "/organizer", label: "Organizador" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 hidden md:block border-b border-border bg-background/95 backdrop-blur-lg">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <Ticket className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">IngressoFácil</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to ||
              (link.to !== "/" && location.pathname.startsWith(link.to));
            
            return (
              <Link key={link.to} to={link.to}>
                <Button
                  variant="ghost"
                  className={cn(
                    "font-medium",
                    isActive && "bg-secondary text-foreground"
                  )}
                >
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="outline" size="sm">
              Minha Conta
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
