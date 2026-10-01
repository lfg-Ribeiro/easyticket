import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, XCircle, AlertTriangle, LogOut } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useScannerAudio } from "@/hooks/useScannerAudio";

type ScanResult = {
  status: "valid" | "used" | "invalid";
  message: string;
  description: string;
  ticket?: { holder_name: string; holder_email: string; event_title: string };
} | null;

export default function Validator() {
  const navigate = useNavigate();
  const { user, loading, rolesLoaded, isAdmin, isValidator, signOut } = useAuth();
  const allowed = isAdmin || isValidator || user?.email === "lribeiro@easyticket.com";
  const [events, setEvents] = useState<{ id: string; title: string; event_date: string }[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [validating, setValidating] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const { playSuccess, playError } = useScannerAudio();

  useEffect(() => {
    if (loading || (user && !rolesLoaded)) return;
    if (!user) navigate("/auth", { replace: true });
    else if (!allowed) navigate("/", { replace: true });
  }, [loading, rolesLoaded, user, allowed, navigate]);

  useEffect(() => {
    if (!allowed) return;
    supabase
      .from("events")
      .select("id,title,event_date")
      .is("deleted_at", null)
      .order("event_date", { ascending: true })
      .then(({ data }) => setEvents(data ?? []));
  }, [allowed]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
      setScanning(false);
    }
  }, []);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  const handleQrScan = async (qr: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setValidating(true);
    await stopScanner();
    try {
      const { data, error } = await supabase.functions.invoke("validate-ticket", {
        body: { qr_code: qr, event_id: eventId },
      });
      const r: NonNullable<ScanResult> = error || data?.error
        ? { status: "invalid", message: "Ingresso Inválido", description: data?.error || "Não foi possível validar." }
        : data;
      r.status === "valid" ? playSuccess() : playError();
      setResult(r);
    } catch {
      playError();
      setResult({ status: "invalid", message: "Erro de conexão", description: "Tente novamente." });
    } finally {
      setValidating(false);
      busyRef.current = false;
    }
  };

  const startScanner = async () => {
    if (scannerRef.current) return;
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, handleQrScan, () => {});
      setScanning(true);
    } catch (e) {
      console.error(e);
      scannerRef.current = null;
    }
  };

  if (loading || !user || !rolesLoaded || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (result) {
    const ok = result.status === "valid";
    const Icon = ok ? CheckCircle2 : result.status === "used" ? AlertTriangle : XCircle;
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center ${ok ? "bg-success" : "bg-destructive"} text-primary-foreground`}
        onClick={() => { setResult(null); startScanner(); }}
      >
        <Icon className="h-32 w-32 mb-6" />
        <h1 className="text-4xl font-bold mb-3">{ok ? "Ingresso Válido" : result.message}</h1>
        <p className="text-lg opacity-90 mb-4">{result.description}</p>
        {result.ticket && <p className="text-2xl font-semibold">{result.ticket.holder_name}</p>}
        <p className="mt-10 text-sm opacity-80">Toque na tela para escanear o próximo</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-safe space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Select value={eventId} onValueChange={(v) => { setEventId(v); }}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
          <SelectContent>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={async () => { await stopScanner(); await signOut(); navigate("/auth", { replace: true }); }}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      <div className="relative rounded-2xl overflow-hidden bg-secondary aspect-square">
        <div id="qr-reader" className="w-full h-full" />
        {!scanning && !validating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button variant="gradient" size="lg" disabled={!eventId} onClick={startScanner}>
              <Camera className="h-5 w-5 mr-2" />
              {eventId ? "Iniciar Leitura" : "Escolha o evento"}
            </Button>
          </div>
        )}
        {validating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
