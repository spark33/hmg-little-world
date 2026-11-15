import type { NavigationStatus, Reply } from "./bridge";

export interface NavigationPresentation {
  status: NavigationStatus;
  title: string;
  detail: string;
  canRetry: boolean;
  canCancel: boolean;
}

/** A successful submission or completed route search never implies travel or arrival. */
export function describeNavigation(
  reply: Reply | null,
): NavigationPresentation {
  const status = reply?.navigationStatus ?? "unavailable";
  const base = { status, canRetry: reply?.canRetry === true, canCancel: false };
  switch (status) {
    case "ready":
      return {
        ...base,
        title: "Navigation service ready",
        detail:
          "Only approved, verified destinations can be sent to the vehicle navigation app.",
      };
    case "submitted":
      return {
        ...base,
        canCancel: true,
        title: "Route request submitted",
        detail:
          "The vehicle navigation app is processing the request. This does not confirm a route or arrival.",
      };
    case "routing":
      return {
        ...base,
        canCancel: true,
        title: "Finding a route",
        detail:
          "Route search is in progress in the vehicle navigation app. No visit has been recorded.",
      };
    case "route-ready":
      return {
        ...base,
        canCancel: true,
        title: "Route search finished",
        detail:
          "Check the vehicle navigation app for guidance. Search completion does not confirm arrival.",
      };
    case "cancel-requested":
      return {
        ...base,
        title: "Cancellation requested",
        detail:
          "Check the vehicle navigation app to confirm the route stopped. No cancellation or arrival is assumed.",
      };
    case "disconnected":
      return {
        ...base,
        title: "Navigation service disconnected",
        detail:
          "Refresh the status or retry the connection when available. Sample journeys remain demonstrations.",
      };
    case "denied":
      return {
        ...base,
        canRetry: false,
        title: "Navigation permission unavailable",
        detail:
          "The vehicle has not granted the required navigation permission. ROAMY cannot start a route.",
      };
    case "timeout":
      return {
        ...base,
        title: "Navigation did not respond",
        detail: "No route outcome is known. Refresh before trying again.",
      };
    case "error":
      return {
        ...base,
        title: "Navigation request unavailable",
        detail:
          "The service could not process this request. Refresh its status before trying again.",
      };
    case "closed":
      return {
        ...base,
        canRetry: false,
        title: "Navigation session stopped",
        detail: "Reopen ROAMY to connect again. No arrival has been recorded.",
      };
    case "cancelled":
      return {
        ...base,
        canRetry: false,
        title: "Status check dismissed",
        detail:
          "This status check was dismissed. It did not cancel a route in the vehicle navigation app.",
      };
    default:
      return {
        ...base,
        title:
          reply?.reason === "trusted-parked-signal-required"
            ? "Waiting for vehicle safety verification"
            : "Live navigation unavailable",
        detail:
          reply?.reason === "verified-destinations-unconfigured"
            ? "No approved destination provider is configured. Sample venues never start real routes."
            : "Sample venues and distances are illustrative. No real route will start from a demo destination.",
      };
  }
}
