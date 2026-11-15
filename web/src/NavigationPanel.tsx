import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelNavigation,
  requestCapabilities,
  requestNavigationStatus,
  retryNavigationConnection,
  type Reply,
} from "./bridge";
import { describeNavigation } from "./navigation";

/** Entertainment-app settings status, not a navigation map or a simulated routing service. */
export function NavigationPanel({ permitted }: { permitted: boolean }) {
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const check = useCallback(
    async (action: "refresh" | "status" | "retry" | "cancel") => {
      if (!permitted) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setBusy(true);
      setNotice("");
      const functions = {
        refresh: requestCapabilities,
        status: requestNavigationStatus,
        retry: retryNavigationConnection,
        cancel: cancelNavigation,
      };
      const result = await functions[action](controller.signal);
      if (controller.signal.aborted) return;
      setReply(result);
      setBusy(false);
      request.current = null;
      if (action === "retry" && !result.available)
        setNotice(
          "A connection retry could not be started. Refresh to check the current status.",
        );
      if (action === "cancel" && !result.available)
        setNotice(
          "Cancellation could not be requested. Check the vehicle navigation app.",
        );
    },
    [permitted],
  );
  useEffect(() => {
    if (permitted) void check("refresh");
    else {
      request.current?.abort();
      setReply(null);
      setBusy(false);
    }
    return () => request.current?.abort();
  }, [permitted, check]);
  const status = reply?.navigationStatus;
  useEffect(() => {
    if (
      !permitted ||
      !["submitted", "routing", "cancel-requested"].includes(status ?? "")
    )
      return;
    const timer = window.setInterval(() => {
      void check("status");
    }, 2500);
    return () => window.clearInterval(timer);
  }, [permitted, status, check]);
  if (!permitted) return null;
  const view = describeNavigation(reply);
  return (
    <section className="navigation-status" aria-label="Live navigation status">
      <h3>Vehicle navigation</h3>
      <div role="status" aria-live="polite">
        <strong>{busy && !reply ? "Checking navigation…" : view.title}</strong>
        <p>{view.detail}</p>
        {notice && <p>{notice}</p>}
      </div>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void check("refresh")}
      >
        Refresh navigation status
      </button>
      {view.canRetry && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void check("retry")}
        >
          Retry navigation connection
        </button>
      )}
      {view.canCancel && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void check("cancel")}
        >
          Request route cancellation
        </button>
      )}
      <p className="fine-print">
        ROAMY delegates route requests to the vehicle navigation app. A
        submitted route never records a visit or arrival.
      </p>
    </section>
  );
}
