import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { User, Settings, HelpCircle, LogOut, ChevronRight, Bell } from "lucide-react";

const menuItems = [
  { icon: User, label: "Editar perfil", action: () => {} },
  { icon: Bell, label: "Notificações", action: () => {} },
  { icon: Settings, label: "Configurações", action: () => {} },
  { icon: HelpCircle, label: "Ajuda e suporte", action: () => {} },
];

export default function Profile() {
  return (
    <MainLayout>
      <div className="container py-6 max-w-lg">
        {/* Profile Header */}
        <section className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">JD</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">João da Silva</h1>
          <p className="text-muted-foreground">joao.silva@email.com</p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card rounded-2xl shadow-card p-4 text-center">
            <p className="text-3xl font-bold text-primary">3</p>
            <p className="text-sm text-muted-foreground">Eventos</p>
          </div>
          <div className="bg-card rounded-2xl shadow-card p-4 text-center">
            <p className="text-3xl font-bold text-primary">5</p>
            <p className="text-sm text-muted-foreground">Ingressos</p>
          </div>
        </section>

        {/* Menu */}
        <section className="bg-card rounded-2xl shadow-card overflow-hidden mb-8">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-4 p-4 hover:bg-secondary transition-colors border-b border-border last:border-0"
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <item.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="flex-1 text-left font-medium text-foreground">
                {item.label}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </section>

        {/* Logout */}
        <Button variant="outline" className="w-full" size="lg">
          <LogOut className="h-5 w-5 mr-2" />
          Sair da conta
        </Button>
      </div>
    </MainLayout>
  );
}
