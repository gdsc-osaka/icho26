// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DowsingCard } from "~/components/dowsing-card";

afterEach(() => {
  cleanup();
});

describe("DowsingCard (smoke test)", () => {
  it("renders idle state with START DOWSING button", () => {
    render(<DowsingCard targetFreqHz={19000} label="DOWSING Q1-1" />);
    // Header shows STATUS / FREQ
    expect(screen.getByText(/STATUS/)).toBeInTheDocument();
    expect(screen.getByText(/19\.0 kHz/)).toBeInTheDocument();
    // STANDBY label appears when idle
    expect(screen.getByText(/DOWSING Q1-1/)).toBeInTheDocument();
    expect(screen.getByText(/STANDBY/i)).toBeInTheDocument();
    // Start button is rendered
    expect(
      screen.getByRole("button", { name: /START DOWSING/i }),
    ).toBeInTheDocument();
  });

  it("uses the correct frequency label for Q1-2", () => {
    render(<DowsingCard targetFreqHz={20000} label="DOWSING Q1-2" />);
    expect(screen.getByText(/20\.0 kHz/)).toBeInTheDocument();
    expect(screen.getByText(/DOWSING Q1-2/)).toBeInTheDocument();
  });

  it("does not crash when SystemPanel and Icon dependencies are present", () => {
    // Just verify nothing throws on mount/unmount cycle.
    const { unmount } = render(<DowsingCard targetFreqHz={19000} label="X" />);
    unmount();
  });
});
