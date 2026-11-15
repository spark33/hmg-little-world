import type { Safety } from "./domain";

export const NAVIGATION_STATUSES = [
  "unavailable",
  "disconnected",
  "denied",
  "ready",
  "submitted",
  "routing",
  "route-ready",
  "cancel-requested",
  "error",
  "closed",
  "timeout",
  "cancelled",
] as const;
export type NavigationStatus = (typeof NAVIGATION_STATUSES)[number];
export type Request =
  | {
      v: 1;
      id: string;
      type:
        | "capabilities"
        | "navigation-status"
        | "navigation-retry"
        | "navigation-cancel"
        | "audio-request"
        | "audio-release";
    }
  | { v: 1; id: string; type: "navigate"; destinationId: string };
export type Reply = {
  v: 1;
  id: string;
  available?: boolean;
  navigation?: boolean;
  lighting?: boolean;
  audioFocus?: boolean;
  reason?: string;
  navigationStatus?: NavigationStatus;
  canRetry?: boolean;
  destinationId?: string;
  verifiedDestinationCount?: number;
};
declare global {
  interface Window {
    __roamySafety?: unknown;
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const o = value as Record<string, unknown>;
  if (
    o.v !== 1 ||
    typeof o.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(o.id)
  )
    return;
  for (const key of [
    "available",
    "navigation",
    "lighting",
    "canRetry",
    "audioFocus",
  ])
    if (o[key] !== undefined && typeof o[key] !== "boolean") return;
  if (
    o.reason !== undefined &&
    (typeof o.reason !== "string" || o.reason.length > 160)
  )
    return;
  if (
    o.navigationStatus !== undefined &&
    !NAVIGATION_STATUSES.includes(o.navigationStatus as NavigationStatus)
  )
    return;
  if (
    o.destinationId !== undefined &&
    (typeof o.destinationId !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(o.destinationId))
  )
    return;
  if (
    o.verifiedDestinationCount !== undefined &&
    (!Number.isInteger(o.verifiedDestinationCount) ||
      (o.verifiedDestinationCount as number) < 0 ||
      (o.verifiedDestinationCount as number) > 100)
  )
    return;
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
  destinationId: string,
  signal?: AbortSignal,
): Promise<Reply> {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(destinationId))
    return Promise.resolve({
      v: 1,
      id: crypto.randomUUID(),
      available: false,
      navigationStatus: "unavailable",
      reason: "invalid-destination-id",
    });
  return request({ type: "navigate", destinationId }, signal);
}
export const requestCapabilities = (signal?: AbortSignal) =>
  request({ type: "capabilities" }, signal);
export const requestNavigationStatus = (signal?: AbortSignal) =>
  request({ type: "navigation-status" }, signal);
export const retryNavigationConnection = (signal?: AbortSignal) =>
  request({ type: "navigation-retry" }, signal);
export const cancelNavigation = (signal?: AbortSignal) =>
  request({ type: "navigation-cancel" }, signal);
export const requestAudioFocus = (signal?: AbortSignal) =>
  request({ type: "audio-request" }, signal);
export const releaseAudioFocus = (signal?: AbortSignal) =>
  request({ type: "audio-release" }, signal);

type RequestBody =
  | { type: "navigate"; destinationId: string }
  | {
      type:
        | "capabilities"
        | "navigation-status"
        | "navigation-retry"
        | "navigation-cancel"
        | "audio-request"
        | "audio-release";
    };
function request(body: RequestBody, signal?: AbortSignal): Promise<Reply> {
  const id = crypto.randomUUID();
  const fallback = (
    navigationStatus: NavigationStatus,
    reason: string,
  ): Reply => ({
    v: 1,
    id,
    available: false,
    navigation: false,
    lighting: false,
    audioFocus: false,
    navigationStatus,
    reason,
    canRetry: navigationStatus === "timeout" || navigationStatus === "error",
    verifiedDestinationCount: 0,
  });
  if (signal?.aborted)
    return Promise.resolve(
      fallback("cancelled", "navigation-request-cancelled"),
    );
  const bridge = window.NativeBridge;
  if (!bridge)
    return Promise.resolve(
      fallback("unavailable", "navigation-service-unavailable"),
    );
  if ((pending.get(bridge)?.size ?? 0) >= 16)
    return Promise.resolve(fallback("error", "too-many-navigation-requests"));
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
    const cancel = () =>
      finish(fallback("cancelled", "navigation-request-cancelled"));
    const timer = window.setTimeout(
      () => finish(fallback("timeout", "navigation-response-timeout")),
      1800,
    );
    requests.set(id, finish);
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      bridge.postMessage(
        JSON.stringify({ v: 1, id, ...body } satisfies Request),
      );
    } catch {
      finish(fallback("error", "navigation-transport-error"));
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
        if (typeof event.data !== "string" || event.data.length > 4096) return;
        const reply = parseReply(JSON.parse(event.data));
        if (reply) pending.get(bridge)?.get(reply.id)?.(reply);
      } catch {
        // Malformed and unrelated replies cannot resolve a request.
      }
    };
  }
  return requests;
}
