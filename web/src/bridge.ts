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
    typeof s.state !== "string" ||
    !["parked", "driving", "unknown"].includes(s.state) ||
    typeof s.preview !== "boolean"
  )
    return;
  return s as Safety;
}
export function requestNavigation(
  destinationId: "nearby" | "weekend" | "chicago",
  signal?: AbortSignal,
): Promise<Reply> {
  const id = crypto.randomUUID();
  const fallback: Reply = {
    v: 1,
    id,
    available: false,
    reason: "Demo adapter · live navigation unavailable",
  };
  if (signal?.aborted) return Promise.resolve(fallback);
  const bridge = window.NativeBridge;
  if (!bridge) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const requests = pendingFor(bridge);
    let settled = false;
    const finish = (reply: Reply) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      requests.delete(id);
      if (requests.size === 0) {
        bridge.onmessage = null;
        pending.delete(bridge);
      }
      resolve(reply);
    };
    const cancel = () => finish(fallback);
    const timer = window.setTimeout(cancel, 1800);
    requests.set(id, finish);
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      bridge.postMessage(
        JSON.stringify({
          v: 1,
          id,
          type: "navigate",
          destinationId,
        } satisfies Request),
      );
    } catch {
      finish(fallback);
    }
  });
}

type NativeTransport = NonNullable<Window["NativeBridge"]>;
const pending = new WeakMap<
  NativeTransport,
  Map<string, (reply: Reply) => void>
>();
function pendingFor(bridge: NativeTransport) {
  let requests = pending.get(bridge);
  if (!requests) {
    requests = new Map();
    pending.set(bridge, requests);
    bridge.onmessage = (event) => {
      try {
        const reply = parseReply(JSON.parse(event.data));
        if (reply) pending.get(bridge)?.get(reply.id)?.(reply);
      } catch {
        // Malformed and unrelated replies cannot resolve a request.
      }
    };
  }
  return requests;
}
