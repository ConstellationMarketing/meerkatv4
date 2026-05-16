// Test helpers for dispatching DOM events with a chosen `isTrusted` value.
//
// jsdom's dispatchEvent resets `isTrusted` to false per spec. To keep our
// trusted flag through dispatch, we replace the impl's `isTrusted` property
// with an accessor whose setter ignores writes and whose getter always
// returns true. The underlying getter on the Event instance reads through
// impl.isTrusted, so the listener observes `true`.

function implOf(ev: Event): Record<string, unknown> {
  const sym = Object.getOwnPropertySymbols(ev).find(
    (s) => String(s) === "Symbol(impl)",
  );
  if (!sym) throw new Error("jsdom impl symbol not found on Event");
  return (ev as unknown as Record<symbol, Record<string, unknown>>)[sym];
}

export function fireTrusted(type: string, target: EventTarget = document): void {
  const ev = new Event(type, { bubbles: true });
  Object.defineProperty(implOf(ev), "isTrusted", {
    get: () => true,
    set: () => {
      // Swallow the spec-mandated reset during dispatchEvent.
    },
    configurable: true,
  });
  target.dispatchEvent(ev);
}

export function fireSynthetic(type: string, target: EventTarget = document): void {
  target.dispatchEvent(new Event(type, { bubbles: true }));
}
