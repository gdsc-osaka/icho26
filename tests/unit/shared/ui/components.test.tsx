// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ErrorAlert,
  GlowButton,
  LoadingOverlay,
  MonospaceLog,
  StageHeader,
  SystemPanel,
  TextInput,
} from "~/shared/ui";

describe("shared/ui components", () => {
  it("SystemPanel renders children", () => {
    render(
      <SystemPanel>
        <p>panel body</p>
      </SystemPanel>
    );
    expect(screen.getByText("panel body")).toBeInTheDocument();
  });

  it("GlowButton fires onClick and is type=button by default", () => {
    const onClick = vi.fn();
    render(<GlowButton onClick={onClick}>SUBMIT</GlowButton>);
    const btn = screen.getByRole("button", { name: /submit/i });
    expect(btn).toHaveAttribute("type", "button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("GlowButton respects disabled prop", () => {
    const onClick = vi.fn();
    render(
      <GlowButton onClick={onClick} disabled>
        SUBMIT
      </GlowButton>
    );
    const btn = screen.getByRole("button", { name: /submit/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("TextInput links label to input via id", () => {
    render(<TextInput label="ANSWER" name="answer" />);
    const input = screen.getByLabelText("ANSWER");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("TextInput shows error message when error prop is set", () => {
    render(<TextInput label="ANSWER" name="answer" error="required" hint="ignored hint" />);
    expect(screen.getByText("required")).toBeInTheDocument();
    expect(screen.queryByText("ignored hint")).not.toBeInTheDocument();
  });

  it("ErrorAlert has role=alert and shows title", () => {
    render(<ErrorAlert title="AUTH FAIL">bad input</ErrorAlert>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/auth fail/i);
    expect(alert).toHaveTextContent("bad input");
  });

  it("LoadingOverlay renders when show=true and hides when show=false", () => {
    const { rerender } = render(<LoadingOverlay show={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<LoadingOverlay show={true} message="SYNC" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("SYNC")).toBeInTheDocument();
  });

  it("StageHeader shows stage and title", () => {
    render(<StageHeader stage="Q2 / CIPHER" title="AUTHORIZATION KEY" />);
    expect(screen.getByText(/q2 \/ cipher/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /authorization key/i })
    ).toBeInTheDocument();
  });

  it("MonospaceLog renders text content", () => {
    render(<MonospaceLog>{"> boot"}</MonospaceLog>);
    expect(screen.getByText("> boot")).toBeInTheDocument();
  });
});
