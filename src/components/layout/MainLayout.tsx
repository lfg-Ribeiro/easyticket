import { ReactNode } from "react";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Sem rolagem horizontal em telas pequenas (360px). No desktop usa "clip" para não quebrar o
  // sticky do painel de checkout (overflow-x: hidden criaria um contêiner de rolagem).
  return (
    <div className="min-h-screen bg-background max-md:overflow-x-hidden md:overflow-x-clip">
      <Header />
      <main className="md:pt-16 pb-20 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
