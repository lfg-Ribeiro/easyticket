import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface ProtectedOrganizerRouteProps {
  children: React.ReactNode;
}

export function ProtectedOrganizerRoute({ children }: ProtectedOrganizerRouteProps) {
  const { user, loading, canAccessOrganizer } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!canAccessOrganizer) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar o painel do organizador.",
        variant: "destructive",
      });
      navigate("/", { replace: true });
    }
  }, [user, loading, canAccessOrganizer, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canAccessOrganizer) return null;

  return <>{children}</>;
}
