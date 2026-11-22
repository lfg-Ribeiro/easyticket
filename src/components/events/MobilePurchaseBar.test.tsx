import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobilePurchaseBar } from "./MobilePurchaseBar";

describe("MobilePurchaseBar", () => {
  it("mostra lote ativo, preço e o CTA 'Comprar ingresso' com área de toque de 44px", () => {
    const onBuy = vi.fn();
    render(<MobilePurchaseBar priceLabel="R$ 50,00" batchName="Lote 1" soldOut={false} onBuy={onBuy} />);

    const bar = screen.getByRole("region", { name: "Comprar ingresso" });
    expect(bar).toHaveTextContent("Lote 1 • A partir de");
    expect(bar).toHaveTextContent("R$ 50,00");

    const cta = screen.getByRole("button", { name: "Comprar ingresso" });
    expect(cta).toBeEnabled();
    expect(cta).toHaveClass("min-h-[44px]", "px-5");
    fireEvent.click(cta);
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it("só no celular, acima da MobileNav, abaixo dos modais (z-40 < z-50) e com altura fixa", () => {
    render(<MobilePurchaseBar priceLabel="R$ 50,00" soldOut={false} onBuy={() => {}} />);
    const bar = screen.getByTestId("mobile-purchase-bar");
    expect(bar).toHaveClass("fixed", "md:hidden", "z-40", "h-20");
    // MobileNav: 4rem + max(1rem, safe-area). A barra encosta exatamente no topo dela.
    expect(bar).toHaveClass("bottom-[calc(4rem+max(1rem,env(safe-area-inset-bottom)))]");
    expect(bar.className).not.toMatch(/z-50/);
  });

  it("sem nome de lote, mostra apenas 'A partir de'", () => {
    render(<MobilePurchaseBar priceLabel="R$ 30,00" soldOut={false} onBuy={() => {}} />);
    expect(screen.getByText("A partir de")).toBeInTheDocument();
  });

  it("esgotado: CTA desabilitado com o texto 'Esgotado' e aviso no lugar do preço", () => {
    const onBuy = vi.fn();
    render(<MobilePurchaseBar priceLabel="R$ 50,00" batchName="Lote 1" soldOut onBuy={onBuy} />);

    const cta = screen.getByRole("button", { name: "Esgotado" });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Ingressos esgotados")).toBeInTheDocument();
    expect(screen.queryByText("R$ 50,00")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comprar ingresso" })).not.toBeInTheDocument();
    fireEvent.click(cta);
    expect(onBuy).not.toHaveBeenCalled();
  });
});
