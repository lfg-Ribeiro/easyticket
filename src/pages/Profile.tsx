import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, LogOut, ChevronRight, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { EditProfileDrawer } from "@/components/profile/EditProfileDrawer";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "Verifique e tente novamente.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const menuItems = [
    { icon: User, label: "Editar perfil", action: () => setEditOpen(true) },
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

        {/* Menu - Só aparece se o usuário estiver logado */}
        {user && (
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
        )}

        {/* Change Password */}
        {user && (
          <section className="bg-card rounded-2xl shadow-card overflow-hidden mb-8 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="font-semibold text-foreground">Alterar senha</h2>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-password" className="text-sm text-muted-foreground">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword}
                className="w-full"
              >
                {changingPassword ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </div>
          </section>
        )}

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
