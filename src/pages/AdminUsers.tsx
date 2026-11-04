import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Role = "admin" | "organizer" | "validator" | "user";
interface AdminUser { id: string; email: string; roles: string[]; event_ids: string[] }
interface Ev { id: string; title: string; event_date: string }
const ROLE_LABEL: Record<string, string> = { admin: "Admin", organizer: "Produtor", validator: "Validador", user: "Cliente" };
const needsEvents = (r: Role) => r === "organizer" || r === "validator";

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user, loading, rolesLoaded, isAdmin } = useAuth();
  const allowed = isAdmin || user?.email === "lribeiro@easyticket.com";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("organizer");
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loading || (user && !rolesLoaded)) return;
    if (!user) navigate("/auth", { replace: true });
    else if (!allowed) navigate("/", { replace: true });
  }, [loading, rolesLoaded, user, allowed, navigate]);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "list" } });
    setBusy(false);
    if (error || data?.error) return toast({ title: "Erro ao carregar", description: data?.error || error?.message, variant: "destructive" });
    setUsers(data.users);
    setEvents(data.events);
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const openNew = () => { setEditing(null); setEmail(""); setPassword(""); setRole("organizer"); setEventIds([]); setOpen(true); };
  const openEdit = (u: AdminUser) => {
    setEditing(u); setEmail(u.email); setPassword("");
    setRole((["admin", "organizer", "validator"].find((r) => u.roles.includes(r)) as Role) || "user");
    setEventIds(u.event_ids); setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: editing ? "update" : "create", user_id: editing?.id, email, password: password || undefined, role, event_ids: needsEvents(role) ? eventIds : [] },
    });
    setSaving(false);
    if (error || data?.error) return toast({ title: "Erro ao salvar", description: data?.error || error?.message, variant: "destructive" });
    toast({ title: editing ? "Usuário atualizado" : "Usuário criado" });
    setOpen(false);
    load();
  };

  if (!allowed) return null;
  const filtered = users.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <MainLayout>
      <div className="container py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gestão de Acessos</h1>
            <p className="text-muted-foreground">Usuários, cargos e eventos permitidos</p>
          </div>
          <Button variant="gradient" onClick={openNew}><Plus className="h-5 w-5 mr-2" />Novo Usuário / Produtor</Button>
        </div>
        <Input placeholder="Buscar por e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {busy ? (
          <p className="text-muted-foreground py-8 text-center">Carregando...</p>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border bg-card">
            {filtered.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.roles.includes("admin") ? "Todos os eventos" : u.roles.length ? `${u.event_ids.length} evento(s) vinculado(s)` : "Comprador — sem acesso administrativo"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {u.roles.length ? u.roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABEL[r]}</Badge>) : <Badge variant="outline">Cliente</Badge>}
                </div>
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] flex flex-col">
          <DialogHeader><DialogTitle>{editing ? "Editar usuário" : "Novo usuário / produtor"}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 p-1">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} disabled={!!editing} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{editing ? "Nova senha (opcional)" : "Senha inicial"}</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizer">Produtor</SelectItem>
                  <SelectItem value="validator">Validador</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">Cliente / Comprador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "user" && (
              <p className="text-sm text-muted-foreground">Clientes não têm acesso ao painel nem a eventos administrativos — apenas compram e veem os próprios ingressos.</p>
            )}
            {needsEvents(role) && (
              <div className="space-y-2">
                <Label>Eventos permitidos</Label>
                {events.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento ativo.</p>}
                {events.map((ev) => (
                  <label key={ev.id} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">
                    <Checkbox
                      checked={eventIds.includes(ev.id)}
                      onCheckedChange={(c) => setEventIds((p) => (c ? [...p, ev.id] : p.filter((x) => x !== ev.id)))}
                    />
                    <span className="flex-1 text-sm">{ev.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(ev.event_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="pb-safe">
            <Button variant="gradient" disabled={saving || (!editing && (!email || password.length < 6))} onClick={save}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
