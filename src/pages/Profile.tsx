import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { User, Settings, HelpCircle, LogOut, ChevronRight, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { EditProfileDrawer } from "@/components/profile/EditProfileDrawer";

interface ProfileData {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, cpf")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (data) setProfileData(data);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const menuItems = [
    { icon: User, label: "Editar perfil", action: () => setEditOpen(true) },
    { icon: Bell, label: "Notificações", action: () => {} },
    { icon: Settings, label: "Configurações", action: () => {} },
    { icon: HelpCircle, label: "Ajuda e suporte", action: () => {} },
  ];

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Visitante";
  const displayEmail = user?.email || "";

  return (
    <MainLayout>
      <div className="container py-6 max-w-lg">
        {/* Profile Header */}
        <section className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
          <p className="text-muted-foreground">{displayEmail}</p>
        </section>

        {/* Profile Completion */}
        {user && profileData && (
          <section className="mb-8">
            <ProfileCompletionCard
              authId={user.id}
              currentPhone={profileData.phone}
              currentCpf={profileData.cpf}
              onComplete={fetchProfile}
            />
          </section>
        )}

        {/* Menu */}
        <section className="bg-card rounded-2xl shadow-card overflow-hidden mb-8">
          {menuItems.map((item) => (
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
        {user ? (
          <Button variant="outline" className="w-full" size="lg" onClick={handleSignOut}>
            <LogOut className="h-5 w-5 mr-2" />
            Sair da conta
          </Button>
        ) : (
          <Button variant="gradient" className="w-full" size="lg" onClick={() => navigate("/auth")}>
            Entrar na conta
          </Button>
        )}
      </div>

      {/* Edit Profile Drawer */}
      {user && profileData && (
        <EditProfileDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          authId={user.id}
          currentName={profileData.full_name}
          currentPhone={profileData.phone}
          currentCpf={profileData.cpf}
          onSaved={fetchProfile}
        />
      )}
    </MainLayout>
  );
}
