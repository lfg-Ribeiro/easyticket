import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface ProtectedOrganizerRouteProps {
  children: React.ReactNode;
  /** Require full management rights (admin / master), not just read-only producer access. */
  requireManage?: boolean;
}

export function ProtectedOrganizerRoute({ children, requireManage = false }: ProtectedOrganizerRouteProps) {
  const { user, loading, rolesLoaded, canAccessOrganizer, canManageEvents } = useAuth();
  const navigate = useNavigate();
  const waiting = loading || (!!user && !rolesLoaded);
  const allowed = requireManage ? canManageEvents : canAccessOrganizer;

  useEffect(() => {
    if (waiting) return;

    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!allowed) {
      toast({
        title: "Acesso Negado",
        description: requireManage
          ? "Somente administradores podem acessar esta área."
          : "Você não tem permissão para acessar o painel do organizador.",
        variant: "destructive",
      });
      navigate(requireManage && canAccessOrganizer ? "/organizer" : "/", { replace: true });
    }
  }, [user, waiting, allowed, requireManage, canAccessOrganizer, navigate]);

  if (waiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !allowed) return null;

  return <>{children}</>;
}
