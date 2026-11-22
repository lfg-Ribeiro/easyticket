import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainLayout } from "./MainLayout";

vi.mock("./Header", () => ({ Header: () => <header>header</header> }));
vi.mock("./MobileNav", () => ({ MobileNav: () => <nav>nav</nav> }));

describe("MainLayout — sem rolagem horizontal", () => {
  it("corta overflow horizontal no celular e usa 'clip' no desktop (preserva o sticky do checkout)", () => {
    render(
      <MainLayout>
        <p>conteúdo</p>
      </MainLayout>,
    );
    const root = screen.getByText("conteúdo").closest("main")!.parentElement!;
    expect(root).toHaveClass("max-md:overflow-x-hidden", "md:overflow-x-clip");
    expect(root.className).not.toMatch(/(^|\s)overflow-x-hidden(\s|$)/); // hidden no desktop quebraria o sticky
  });

  it("mantém folga para a MobileNav", () => {
    render(
      <MainLayout>
        <p>x</p>
      </MainLayout>,
    );
    expect(screen.getByText("x").closest("main")).toHaveClass("pb-20", "md:pb-0");
  });
});
