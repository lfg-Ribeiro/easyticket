import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const handleAddToWallet = () => {
    toast({
      title: "Em breve!",
      description: "A integração com carteiras digitais estará disponível em breve.",
    });
  };

  return (
    <div className={className}>
      <Button
        onClick={handleAddToWallet}
        variant="outline"
        size="lg"
        className="w-full gap-2.5 border-2 font-semibold"
      >
        <Smartphone className="h-5 w-5" />
        Adicionar ao Apple / Google Wallet
      </Button>
    </div>
  );
}
