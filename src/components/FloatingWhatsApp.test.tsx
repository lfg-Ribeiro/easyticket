import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MobilePurchaseBar } from "@/components/events/MobilePurchaseBar";
import { FloatingWhatsApp } from "./FloatingWhatsApp";

const NAV = "4rem+max(1rem,env(safe-area-inset-bottom))"; // altura da MobileNav
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FloatingWhatsApp />
    </MemoryRouter>,
  );
const link = () => screen.getByRole("link", { name: "Suporte via WhatsApp" });

describe("FloatingWhatsApp — posição no celular", () => {
  it("página de evento: fica ACIMA da barra de compra (nav + 5rem da barra + folga)", () => {
    renderAt("/event/e1");
    expect(link()).toHaveClass(`bottom-[calc(${NAV}+5rem+0.75rem)]`, "right-4");
    expect(link()).toHaveClass("md:bottom-6", "md:right-6"); // desktop: canto normal
    expect(link().className).not.toMatch(/\bbottom-40\b/);
  });

  it("o deslocamento usa exatamente a altura da barra de compra (h-20 = 5rem) — sem colisão", () => {
    const { unmount } = render(<MobilePurchaseBar priceLabel="R$ 50,00" soldOut={false} onBuy={() => {}} />);
    const bar = screen.getByTestId("mobile-purchase-bar");
    const barBottom = /bottom-\[calc\((.+)\)\]/.exec(bar.className)?.[1]; // topo da MobileNav
    expect(barBottom).toBe(NAV);
    expect(bar).toHaveClass("h-20");
    unmount();

    renderAt("/event/e1");
    // botão do WhatsApp começa em: topo da nav + altura da barra (5rem) + 0,75rem de respiro
    expect(link().className).toContain(`bottom-[calc(${barBottom}+5rem+0.75rem)]`);
  });

  it("demais páginas: só acima da MobileNav (sem o deslocamento da barra de compra)", () => {
    renderAt("/");
    expect(link()).toHaveClass(`bottom-[calc(${NAV}+0.75rem)]`, "right-4");
    expect(link().className).not.toMatch(/\+5rem\+/); // sem a altura da barra de compra
  });

  it("painel do organizador: vai para o canto esquerdo (os FABs ocupam a direita)", () => {
    renderAt("/organizer");
    expect(link()).toHaveClass(`bottom-[calc(${NAV}+0.75rem)]`, "left-4");
  });

  it("z-40: abaixo dos modais/drawers (z-50)", () => {
    renderAt("/event/e1");
    expect(link()).toHaveClass("z-40");
  });
});
