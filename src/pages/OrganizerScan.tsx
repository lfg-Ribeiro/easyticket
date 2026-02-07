import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ScanResult = {
  status: "valid" | "used" | "invalid";
  message: string;
  description: string;
  ticket?: {
    holder_name: string;
    holder_email: string;
    event_title: string;
  };
} | null;

export default function OrganizerScan() {
  const navigate = useNavigate();
  const { user, loading, session } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [validating, setValidating] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  const startScanner = useCallback(async () => {
    if (scannerRef.current || !containerRef.current) return;

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleQrScan(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current = null;
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleQrScan = async (qrCode: string) => {
    if (validating) return;
    setValidating(true);
    await stopScanner();

    try {
      const { data, error } = await supabase.functions.invoke("validate-ticket", {
        body: { qr_code: qrCode },
      });

      if (error) {
        setResult({
          status: "invalid",
          message: "Erro na validação",
          description: "Não foi possível validar este ingresso.",
        });
      } else {
        setResult(data as ScanResult);
      }
    } catch {
      setResult({
        status: "invalid",
        message: "Erro de conexão",
        description: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleScanAgain = () => {
    setResult(null);
    startScanner();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getResultColors = () => {
    if (!result) return {};
    switch (result.status) {
      case "valid":
        return { bg: "bg-success/10", border: "border-success", text: "text-success", icon: CheckCircle2 };
      case "used":
        return { bg: "bg-destructive/10", border: "border-destructive", text: "text-destructive", icon: AlertTriangle };
      case "invalid":
        return { bg: "bg-destructive/10", border: "border-destructive", text: "text-destructive", icon: XCircle };
      default:
        return {};
    }
  };

  const colors = getResultColors();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/organizer")} className="p-2 -ml-2 hover:bg-secondary rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Validador de Ingressos</h1>
        </div>
      </header>

      <div className="container max-w-md py-6 space-y-6">
        {/* Scanner or Result */}
        {!result ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <Camera className="h-8 w-8 mx-auto text-primary" />
              <h2 className="text-xl font-bold">Escanear QR Code</h2>
              <p className="text-sm text-muted-foreground">
                Aponte a câmera para o QR Code do ingresso
              </p>
            </div>

            {/* QR Scanner Container */}
            <div
              ref={containerRef}
              className="relative rounded-2xl overflow-hidden bg-secondary aspect-square"
            >
              <div id="qr-reader" className="w-full h-full" />
              {!scanning && !validating && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button onClick={startScanner} variant="gradient" size="lg">
                    <Camera className="h-5 w-5 mr-2" />
                    Iniciar Scanner
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
        ) : (
          <div className="space-y-6 animate-fade-up">
            {/* Result Card */}
            <div className={`p-8 rounded-2xl border-2 ${colors.bg} ${colors.border} text-center space-y-4`}>
              {colors.icon && <colors.icon className={`h-16 w-16 mx-auto ${colors.text}`} />}
              <h2 className={`text-2xl font-bold ${colors.text}`}>{result.message}</h2>
              <p className="text-muted-foreground">{result.description}</p>
            </div>

            {/* Ticket Info */}
            {result.ticket && (
              <div className="bg-card rounded-xl p-4 shadow-card space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Detalhes do ingresso</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome</span>
                    <span className="font-medium">{result.ticket.holder_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">E-mail</span>
                    <span className="font-medium text-xs">{result.ticket.holder_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evento</span>
                    <span className="font-medium">{result.ticket.event_title}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <Button onClick={handleScanAgain} variant="gradient" size="lg" className="w-full">
              <Camera className="h-5 w-5 mr-2" />
              Escanear Outro
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
