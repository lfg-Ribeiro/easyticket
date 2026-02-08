import { Link, useLocation } from "react-router-dom";
import { Home, Ticket, User, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";

export function MobileNav() {
  const location = useLocation();
  const { isOrganizer } = useAuth();

  const navItems = useMemo(() => {
    const items = [
      { to: "/", icon: Home, label: "Eventos" },
      { to: "/tickets", icon: Ticket, label: "Ingressos" },
    ];
    if (isOrganizer) {
      items.push({ to: "/organizer", icon: LayoutDashboard, label: "Organizar" });
    }
    items.push({ to: "/profile", icon: User, label: "Perfil" });
    return items;
  }, [isOrganizer]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg pb-safe md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== "/" && location.pathname.startsWith(item.to));
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
