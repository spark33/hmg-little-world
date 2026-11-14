import type { Safety } from "./domain";
export type Request =
  | { v: 1; id: string; type: "capabilities" }
  | {
      v: 1;
      id: string;
      type: "navigate";
      destinationId: "nearby" | "weekend" | "chicago";
    };
export type Reply = {
  v: 1;
  id: string;
  available?: boolean;
  navigation?: boolean;
  lighting?: boolean;
  reason?: string;
};
declare global {
  interface Window {
    NativeBridge?: {
      postMessage: (s: string) => void;
      onmessage: ((event: MessageEvent) => void) | null;
    };
  }
}
export const nativeHost =
  typeof location !== "undefined" &&
  location.hostname === "appassets.androidplatform.net";
export function parseReply(value: unknown): Reply | undefined {
  if (!value || typeof value !== "object") return;
  const o = value as Record<string, unknown>;
  if (
    o.v !== 1 ||
    typeof o.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(o.id)
  )
    return;
  for (const key of ["available", "navigation", "lighting"])
    if (o[key] !== undefined && typeof o[key] !== "boolean") return;
  if (o.reason !== undefined && typeof o.reason !== "string") return;
  return o as Reply;
}
export function parseSafety(value: unknown): Safety | undefined {
  if (!value || typeof value !== "object") return;
  const s = value as Record<string, unknown>;
  if (
    !["parked", "driving", "unknown"].includes(String(s.state)) ||
    typeof s.preview !== "boolean"
  )
    return;
  return s as Safety;
}
export function requestNavigation(
  destinationId: "nearby" | "weekend" | "chicago",
): Promise<Reply> {
  const id = crypto.randomUUID();
  const fallback: Reply = {
    v: 1,
    id,
    available: false,
    reason: "Demo adapter · live navigation unavailable",
  };
  if (!window.NativeBridge) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const bridge = window.NativeBridge!;
    const timer = window.setTimeout(() => {
      bridge.onmessage = null;
      resolve(fallback);
    }, 1800);
    bridge.onmessage = (event) => {
      try {
        const reply = parseReply(JSON.parse(event.data));
        if (reply?.id === id) {
          clearTimeout(timer);
          bridge.onmessage = null;
          resolve(reply);
        }
      } catch {
        /* reject malformed response by waiting for fallback */
      }
    };
    bridge.postMessage(
      JSON.stringify({
        v: 1,
        id,
        type: "navigate",
        destinationId,
      } satisfies Request),
    );
  });
}
