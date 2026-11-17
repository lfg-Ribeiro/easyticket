import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventGridSkeleton } from "./EventCardSkeleton";
import { EventDetailSkeleton } from "./EventDetailSkeleton";
import { MetricCardsSkeleton, ParticipantsTableSkeleton } from "../organizer/OrganizerSkeletons";

describe("skeletons", () => {
  it("grade da Home usa a mesma grade responsiva e anuncia o carregamento", () => {
    const { container } = render(<EventGridSkeleton count={6} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando eventos…")).toBeInTheDocument();
    expect(container.querySelector(".sm\\:grid-cols-2.lg\\:grid-cols-3.gap-5")).not.toBeNull();
    expect(container.querySelectorAll("article")).toHaveLength(6);
  });

  it("detalhe do evento tem hero 16/9 -> 21/9, card sobreposto e sidebar no desktop", () => {
    const { container } = render(<EventDetailSkeleton />);
    expect(container.querySelector(".aspect-\\[16\\/9\\].md\\:aspect-\\[21\\/9\\]")).not.toBeNull();
    expect(container.querySelector(".-mt-16")).not.toBeNull();
    expect(container.querySelector(".md\\:col-span-2")).not.toBeNull();
  });

  it("organizador: 6 cards de métrica e 10 linhas de participantes", () => {
    const metrics = render(<MetricCardsSkeleton />);
    expect(metrics.container.querySelectorAll(".shadow-card")).toHaveLength(6);
    metrics.unmount();

    const table = render(<ParticipantsTableSkeleton rows={10} />);
    expect(table.container.querySelectorAll("tbody tr")).toHaveLength(10);
  });
});