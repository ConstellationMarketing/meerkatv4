import { describe, it, expect } from "vitest";
import { fireTrusted, fireSynthetic } from "./events";

describe("event helpers end-to-end", () => {
  it("handler observes isTrusted=true for fireTrusted", () => {
    let seen: boolean | null = null;
    const handler = (e: Event) => {
      seen = e.isTrusted;
    };
    document.addEventListener("keydown", handler, { capture: true });
    fireTrusted("keydown");
    document.removeEventListener("keydown", handler, { capture: true } as any);
    expect(seen).toBe(true);
  });

  it("handler observes isTrusted=false for fireSynthetic", () => {
    let seen: boolean | null = null;
    const handler = (e: Event) => {
      seen = e.isTrusted;
    };
    document.addEventListener("keydown", handler, { capture: true });
    fireSynthetic("keydown");
    document.removeEventListener("keydown", handler, { capture: true } as any);
    expect(seen).toBe(false);
  });
});
