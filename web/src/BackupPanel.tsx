import { useId, useMemo, useRef, useState } from "react";
import {
  clearRecoveryData,
  exportBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  parseWorld,
  readPreservedSave,
  readRecovery,
  saveWorld,
  STORAGE_KEY,
  type PersistenceConfig,
  type StorageLike,
  type WorldState,
} from "./persistence";

export interface BackupPanelProps {
  world: WorldState;
  storage: StorageLike;
  config: PersistenceConfig;
  /** Called only after the explicitly confirmed world has been saved successfully. */
  onRestore: (world: WorldState) => void;
}
type Pending =
  { kind: "import" | "recovery"; world: WorldState } | { kind: "clear" } | null;

export default function BackupPanel({
  world,
  storage,
  config,
  onRestore,
}: BackupPanelProps) {
  const importId = useId();
  const fileId = useId();
  const exportArea = useRef<HTMLTextAreaElement | null>(null);
  const confirmation = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState("");
  const [exported, setExported] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [copiesVersion, setCopiesVersion] = useState(0);
  const recovery = useMemo(
    () => readRecovery(storage, config),
    [world, storage, config, copiesVersion],
  );
  const preserved = useMemo(() => {
    try {
      const current = storage.getItem(STORAGE_KEY);
      return current && parseWorld(current, config).status !== "ready"
        ? current
        : readPreservedSave(storage);
    } catch {
      return null;
    }
  }, [world, storage, config, copiesVersion]);

  function feedback(value: string, failed = false) {
    setMessage(value);
    setError(failed);
  }
  function review(next: NonNullable<Pending>) {
    setPending(next);
    feedback("");
    // The confirmation remains in the same scrolling panel as the user action.
    window.requestAnimationFrame(() =>
      confirmation.current?.focus({ preventScroll: false }),
    );
  }
  function prepareExport() {
    try {
      setExported(exportBackup(world, config));
      feedback(
        "Backup prepared. Copy the complete text and keep it somewhere private.",
      );
    } catch {
      feedback(
        "A valid backup could not be prepared. Your saved data has not been changed.",
        true,
      );
    }
  }
  async function copyExport() {
    try {
      if (!navigator.clipboard?.writeText) throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(exported);
      feedback(
        "Backup copied. Clipboard contents and saved backup text are not encrypted.",
      );
    } catch {
      exportArea.current?.focus();
      exportArea.current?.select();
      feedback(
        "Automatic copy is unavailable. The complete backup is selected; use your device’s Copy command.",
      );
    }
  }
  function reviewImport() {
    const parsed = parseBackup(text, config);
    if (parsed.status !== "ready") {
      setPending(null);
      feedback(parsed.reason, true);
      return;
    }
    review({ kind: "import", world: parsed.state });
  }
  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      feedback(
        "The backup exceeds the 64 KiB limit. Your saved data has not been changed.",
        true,
      );
      return;
    }
    try {
      setText(await file.text());
      setPending(null);
      feedback("File loaded for review. Your saved world has not changed.");
    } catch {
      feedback(
        "The file could not be read. You can paste the backup text instead.",
        true,
      );
    }
  }
  function confirm() {
    if (!pending) return;
    if (pending.kind === "clear") {
      if (!clearRecoveryData(storage)) {
        feedback(
          "Recovery copies could not be cleared. Storage is unavailable.",
          true,
        );
        return;
      }
      setCopiesVersion((value) => value + 1);
      setPending(null);
      setExported("");
      feedback("Recovery copies cleared. The current world has been kept.");
      return;
    }
    if (
      !saveWorld(storage, pending.world, config, { replaceProtected: true })
    ) {
      feedback(
        "The replacement could not be saved. Your current world has been kept. Free device storage or retry later.",
        true,
      );
      return;
    }
    const restored = pending.world;
    setPending(null);
    setText("");
    setExported("");
    setCopiesVersion((value) => value + 1);
    feedback("World restored and saved on this device.");
    onRestore(restored);
  }
  const confirmedCount =
    pending && pending.kind !== "clear"
      ? Object.values(pending.world.collected).filter(
          (record) => record.provenance === "confirmed-demo",
        ).length
      : 0;

  return (
    <section className="backup-panel" aria-label="World backup and recovery">
      <h3>Backup and recovery</h3>
      <p>
        Keep a copy of your world or restore one you saved earlier. This feature
        never uploads your backup.
      </p>
      <p className="backup-privacy">
        Worlds, notes and recovery copies are stored as plain text on this
        device. Backups and clipboard copies are not encrypted. Avoid sensitive
        personal information.
      </p>
      <div className="backup-actions">
        <button className="secondary backup-button" onClick={prepareExport}>
          Prepare world backup
        </button>
        {recovery && (
          <button
            className="secondary backup-button"
            onClick={() => review({ kind: "recovery", world: recovery })}
          >
            Review recovery copy
          </button>
        )}
        {preserved && (
          <button
            className="secondary backup-button"
            onClick={() => {
              setExported(preserved);
              feedback(
                "Original saved data is shown exactly as stored. Keep a private copy before replacing or clearing it.",
              );
            }}
          >
            Show original saved data
          </button>
        )}
      </div>
      {exported && (
        <>
          <label htmlFor={`${importId}-export`}>Complete backup text</label>
          <textarea
            id={`${importId}-export`}
            ref={exportArea}
            className="backup-text"
            aria-label="Exported world backup"
            value={exported}
            readOnly
            spellCheck={false}
          />
          <button className="secondary backup-button" onClick={copyExport}>
            Copy complete backup
          </button>
          <p>
            You can select and copy this text even when file export or automatic
            clipboard access is unavailable.
          </p>
        </>
      )}
      <label htmlFor={importId}>Paste a world backup</label>
      <textarea
        id={importId}
        className="backup-text"
        value={text}
        maxLength={MAX_BACKUP_BYTES}
        spellCheck={false}
        placeholder="Paste the complete ROAMY backup here"
        onChange={(event) => {
          setText(event.currentTarget.value);
          setPending(null);
          feedback("");
        }}
      />
      <label htmlFor={fileId}>
        Or choose a backup file in a supported browser
      </label>
      <input
        id={fileId}
        type="file"
        accept="application/json,.json,text/plain,.txt"
        onChange={(event) => {
          void readFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <p>
        Maximum backup size: 64 KiB. Pasting text works without a file picker.
      </p>
      <button
        className="secondary backup-button"
        disabled={!text.trim()}
        onClick={reviewImport}
      >
        Review imported world
      </button>
      {(recovery || preserved) && (
        <button
          className="secondary backup-button"
          onClick={() => review({ kind: "clear" })}
        >
          Clear recovery copies
        </button>
      )}
      {pending && (
        <div
          ref={confirmation}
          tabIndex={-1}
          className="backup-confirmation"
          role="group"
          aria-label={
            pending.kind === "clear"
              ? "Confirm recovery deletion"
              : "Confirm world replacement"
          }
        >
          <h4>
            {pending.kind === "clear"
              ? "Clear recovery copies?"
              : "Replace the world on this device?"}
          </h4>
          {pending.kind === "clear" ? (
            <p>
              This removes the last recovery world and any preserved unreadable
              save. Export anything you want to keep first. Your current world
              stays unchanged.
            </p>
          ) : (
            <>
              <p className="backup-summary">
                This world contains{" "}
                {Object.keys(pending.world.collected).length} memories:{" "}
                {confirmedCount} confirmed demo keepsakes and{" "}
                {Object.keys(pending.world.collected).length - confirmedCount}{" "}
                illustrative memories.
              </p>
              <p>
                Your current save is copied before replacement. Only the most
                recent valid recovery world and most recent replaced unreadable
                save are retained. Restoring a backup does not verify a real
                visit.
              </p>
            </>
          )}
          <div className="backup-actions">
            <button
              className="secondary backup-button"
              onClick={() => setPending(null)}
            >
              Keep current data
            </button>
            <button className="secondary backup-button" onClick={confirm}>
              {pending.kind === "clear"
                ? "Confirm clear recovery copies"
                : "Confirm replace world"}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="backup-feedback" role={error ? "alert" : "status"}>
          {message}
        </p>
      )}
      <p>
        Resetting the world keeps a recovery copy until you clear it here.
        Uninstalling the app or clearing its data removes local saves and
        recovery copies; browser previews use their own browser storage.
      </p>
    </section>
  );
}
