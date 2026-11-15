import { useEffect, useState } from "react";
import "./third-party.css";

/** Read bundled notices without navigating the hardened WebView away from its entry page. */
export default function ThirdPartyNotices() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || text) return;
    const controller = new AbortController();
    setFailed(false);
    void fetch(new URL("third-party-notices.txt", window.location.href), {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Notices unavailable");
        const value = await response.text();
        if (!value.trim() || value.length > 2_000_000)
          throw new Error("Invalid notices");
        if (!controller.signal.aborted) setText(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [open, attempt, text]);
  return (
    <details
      className="third-party-notices"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Open-source licenses</summary>
      <p>
        ROAMY includes third-party libraries. Their copyright notices and
        license terms are bundled on this device.
      </p>
      {open && !text && !failed && (
        <p role="status">Loading bundled notices…</p>
      )}
      {failed && (
        <div role="alert">
          <p>Bundled notices could not be read.</p>
          <button
            className="secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry reading licenses
          </button>
        </div>
      )}
      {text && (
        <pre tabIndex={0} aria-label="Bundled open-source license text">
          {text}
        </pre>
      )}
    </details>
  );
}
