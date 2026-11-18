import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SeatMap from "@/components/seatmap/SeatMap";
import { SeatLayoutItem, SeatTier } from "@/types";

// Same layout as the seed / production setup: rows A–B VIP, C–D Premium, E–F Standard
const TIERS: Record<string, [SeatTier, number]> = {
  A: ["VIP", 280], B: ["VIP", 280],
  C: ["PREMIUM", 200], D: ["PREMIUM", 200],
  E: ["STANDARD", 150], F: ["STANDARD", 150],
};

const seats: SeatLayoutItem[] = Object.entries(TIERS).flatMap(([rowLabel, [tier, price]]) =>
  [1, 2].map((seatNum) => ({
    id: `${rowLabel}${seatNum}`,
    rowLabel,
    seatNum,
    price,
    tier,
    status: "AVAILABLE" as const,
    heldUntil: null,
  })),
);

function renderMap() {
  return render(<SeatMap seats={seats} selectedSeatIds={[]} onToggleSeat={() => {}} />);
}

describe("SeatMap row order", () => {
  it("draws the cheapest rows nearest the screen and VIP at the back", () => {
    renderMap();
    // Seat buttons appear top-to-bottom; the screen is drawn above the first row
    const rowOrder = [...new Set(screen.getAllByRole("button").map((b) => b.getAttribute("title")!.match(/Row (\w)/)![1]))];
    expect(rowOrder).toEqual(["F", "E", "D", "C", "B", "A"]);
  });

  it("shows each tier band once, Standard first and VIP last, with unchanged prices", () => {
    const { container } = renderMap();
    const bands = [...container.querySelectorAll("span")]
      .map((s) => s.textContent ?? "")
      .filter((t) => t.includes("·"));
    expect(bands).toEqual(["Standard · ฿150", "Premium · ฿200", "VIP · ฿280"]);
  });
});
