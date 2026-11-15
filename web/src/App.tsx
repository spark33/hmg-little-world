import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  Compass,
  Heart,
  Leaf,
  MapPin,
  Moon,
  Plus,
  Minus,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import World from "./World";
import CarCollection, { Shelf, type CollectionTab } from "./CarCollection";
import { KeepsakeArt } from "./KeepsakeArt";
import { activityAllowed, initialSafety, resumablePanel } from "./activity";
import { collectionGroups, curatedReason } from "./journeys";
import { NavigationPanel } from "./NavigationPanel";
import BackupPanel from "./BackupPanel";
import ThirdPartyNotices from "./ThirdPartyNotices";
import {
  canInteract,
  catalog,
  allExperiences,
  legacyCatalog,
  persistenceConfig,
  collect,
  categories,
  collectibleIds,
  destinationsFor,
  experienceDetails,
  nextExperience,
  updateMemory,
  type CategoryFilter,
  destinations,
  initialState,
  localVisitDate,
  readWorld,
  recommend,
  saveWorld,
  type Destination,
  type Safety,
} from "./domain";
import { nativeHost, parseSafety, requestNavigation } from "./bridge";
import { flourish, suspendSound, unlockSound } from "./sound";
import {
  loadPreferences,
  savePreferences,
  type Preferences,
} from "./preferences";
import "./styles.css";
import "./vehicle.css";
import "./car.css";
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
};
type Panel =
  | "memory"
  | "discover"
  | "destinations"
  | "journey"
  | "arrival"
  | "album"
  | "settings"
  | "browse"
  | null;
class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="graphics-failure">
        <Leaf size={40} />
        <h2>A little pause in the world</h2>
        <p>
          3D rendering is unavailable. Enable WebGL in a supported browser or
          update Android System WebView.
        </p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [loaded] = useState(() => readWorld(storage));
  const [world, setWorld] = useState(loaded.state);
  const [unresolvedRead, setUnresolvedRead] = useState(
    loaded.status === "unavailable",
  );
  const [saveConflict, setSaveConflict] = useState<typeof world | null>(null);
  const [protectedSave, setProtectedSave] = useState(
    loaded.status === "corrupt" || loaded.status === "unsupported",
  );
  const [panel, setPanel] = useState<Panel>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() =>
    loadPreferences(
      storage,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  );
  const { night, muted, reducedMotion } = preferences;
  const [preferencesSaved, setPreferencesSaved] = useState(true);
  const [zoom, setZoom] = useState(0);
  const [adventureId, setAdventureId] = useState("mangwon");
  const [category, setCategory] = useState<CategoryFilter>("All keepsakes");
  const [memoryReturn, setMemoryReturn] = useState<"album" | "browse" | null>(
    null,
  );
  const [recommendedFrom, setRecommendedFrom] = useState<string | null>(null);
  const [discoveryReturn, setDiscoveryReturn] = useState<"browse" | null>(null);
  const [noteUpdated, setNoteUpdated] = useState(false);
  const memoryQuote = useRef<HTMLParagraphElement | null>(null);
  const [editingMemory, setEditingMemory] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [lastCollectedId, setLastCollectedId] = useState<string | null>(null);
  const [destination, setDestination] = useState<Destination>(destinations[0]);
  const [navigationStatus, setNavigationStatus] = useState(""),
    [pending, setPending] = useState(false);
  const [collecting, setCollecting] = useState(false),
    [start, setStart] = useState(0),
    [toast, setToast] = useState(""),
    [resetToken, setResetToken] = useState(0);
  const [saved, setSaved] = useState(loaded.status === "ready");
  const [confirmReset, setConfirmReset] = useState(false);
  const [safety, setSafety] = useState<Safety>(() =>
    initialSafety(window.__roamySafety, nativeHost),
  );
  const [active, setActive] = useState(!document.hidden);
  const [focused, setFocused] = useState(true);
  const permitted = activityAllowed(safety, active, focused);
  const [collectionTab, setCollectionTab] = useState<CollectionTab>(() =>
    collectibleIds.some((id) => loaded.state.collected[id])
      ? "memories"
      : "inspiration",
  );
  const [collectionPage, setCollectionPage] = useState(0);
  const [browsePage, setBrowsePage] = useState(0);
  const [browseMode, setBrowseMode] = useState<"new" | "saved">("new");
  const [settingsSection, setSettingsSection] = useState<
    "comfort" | "data" | "backup" | "vehicle" | "about"
  >("comfort");
  const [resumeContext, setResumeContext] = useState<{
    panel: "album" | "browse" | "memory";
    selected: string | null;
    editing: boolean;
    draft: string;
  } | null>(null);
  const sessionContext = useRef({
    panel,
    selected,
    editing: editingMemory,
    draft: memoryDraft,
    collecting,
  });
  sessionContext.current = {
    panel,
    selected,
    editing: editingMemory,
    draft: memoryDraft,
    collecting,
  };
  const [interruptionMessage, setInterruptionMessage] = useState("");
  const wasPermitted = useRef(permitted);
  const interruptionPending = useRef(false);
  const timers = useRef<number[]>([]);
  const navigationRequest = useRef<AbortController | null>(null);
  const soundMuted = useRef(muted);
  const panelElement = useRef<HTMLElement | null>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  const wasPanelOpen = useRef(false);
  const mangwon = Boolean(world.collected.mangwon);
  const experience =
    allExperiences.find((x) => x.id === selected) ?? catalog[0];
  const adventure = catalog.find((x) => x.id === adventureId) ?? catalog[4];
  const details = experienceDetails[adventure.asset];
  const revisiting = Boolean(world.collected[adventure.id]);
  const choices = destinationsFor(adventure.id);
  const confirmedCount = collectibleIds.filter(
    (id) => world.collected[id],
  ).length;
  const complete = confirmedCount === collectibleIds.length;
  const recommendation = recommend(experience.id, world);
  const currentCollectedIds = catalog
    .filter((item) => world.collected[item.id])
    .map((item) => item.id);
  const archived = legacyCatalog.filter((item) => world.collected[item.id]);
  const { confirmed, illustrations } = collectionGroups(world);
  const collectionSummary = `${confirmed.length} ${confirmed.length === 1 ? "memory" : "memories"} · ${illustrations.length} inspirations`;
  const chosenStop = world.collected[experience.id]?.demoDestinationId;
  const chosenDestination = chosenStop
    ? destinationsFor(experience.id).find((item) => item.id === chosenStop)
    : undefined;
  useEffect(() => {
    if (!noteUpdated || editingMemory || panel !== "memory") return;
    memoryQuote.current?.focus({ preventScroll: true });
    memoryQuote.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }, [noteUpdated, editingMemory, panel]);
  useEffect(() => {
    if (loaded.status === "empty") setSaved(saveWorld(storage, loaded.state));
  }, [loaded]);
  useEffect(() => {
    const interrupt = () => {
      navigationRequest.current?.abort();
      navigationRequest.current = null;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      suspendSound();
      if (interruptionPending.current) return;
      interruptionPending.current = true;
      const context = sessionContext.current;
      const resumable = resumablePanel(context.panel);
      if (resumable)
        setResumeContext({
          panel: resumable,
          selected: context.selected,
          editing: context.editing,
          draft: context.draft,
        });
      if (context.panel || context.collecting)
        setInterruptionMessage(
          context.collecting
            ? "Your keepsake was saved. The reveal has been paused."
            : "Your memories are safe. Continue when you are ready.",
        );
      setPanel(null);
      setCollecting(false);
      setCollectingId(null);
      setEditingMemory(false);
      setSaveConflict(null);
      setPending(false);
      setConfirmReset(false);
      setToast("");
    };
    const safetyListener = (event: Event) => {
      const value = parseSafety((event as CustomEvent).detail);
      if (value) {
        if (!canInteract(value)) interrupt();
        setSafety(value);
      }
    };
    const visible = () => {
      if (document.hidden) interrupt();
      setActive(!document.hidden);
    };
    const blur = () => {
      interrupt();
      setFocused(false);
    };
    const focus = () => {
      setFocused(true);
      setActive(!document.hidden);
    };
    const pagehide = () => {
      interrupt();
      setActive(false);
    };
    window.addEventListener("vehicle-safety", safetyListener);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", focus);
    // A native page-finished event may precede React mounting.
    if (nativeHost) setSafety(initialSafety(window.__roamySafety, true));
    return () => {
      window.removeEventListener("vehicle-safety", safetyListener);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", focus);
    };
  }, []);
  useEffect(() => {
    if (wasPermitted.current && !permitted) suspendSound();
    if (permitted) interruptionPending.current = false;
    wasPermitted.current = permitted;
  }, [permitted]);
  useEffect(() => {
    if (saveConflict || protectedSave) setSettingsSection("data");
  }, [saveConflict, protectedSave]);
  useEffect(() => {
    if (panel && collecting) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setCollecting(false);
      setCollectingId(null);
      suspendSound();
    }
  }, [panel, collecting]);
  useEffect(() => {
    if (panel !== "destinations" || !permitted) {
      navigationRequest.current?.abort();
      navigationRequest.current = null;
      setPending(false);
    }
  }, [panel, permitted]);
  useEffect(() => {
    if (panel && permitted) {
      setToast("");
      if (!wasPanelOpen.current)
        panelOpener.current = document.activeElement as HTMLElement;
      if (panelElement.current) {
        panelElement.current.scrollTop = 0;
        panelElement.current.focus({ preventScroll: true });
      }
      wasPanelOpen.current = true;
    } else {
      if (wasPanelOpen.current && permitted && panelOpener.current?.isConnected)
        panelOpener.current.focus({ preventScroll: true });
      wasPanelOpen.current = false;
    }
    if (panel !== "settings") setConfirmReset(false);
    if (panel !== "memory") setEditingMemory(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel) {
        navigationRequest.current?.abort();
        setPanel(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, permitted, selected]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      navigationRequest.current?.abort();
    },
    [],
  );
  function select(id: string, returnTo: "album" | "browse" | null = null) {
    if (!permitted || collecting) return;
    setInterruptionMessage("");
    setResumeContext(null);
    if (!id) {
      setSelected(null);
      return;
    }
    if (id === "plot" || id.startsWith("plot:")) {
      openExperience(id === "plot" ? "mangwon" : id.slice(5));
      return;
    }
    if (!allExperiences.some((x) => x.id === id)) return;
    if (!world.collected[id]) {
      openExperience(id);
      return;
    }
    setSelected(id);
    setMemoryReturn(returnTo);
    setNoteUpdated(false);
    setEditingMemory(false);
    setPanel("memory");
    if (!muted) unlockSound();
  }
  function openExperience(
    id: string,
    revisit = false,
    sourceMemory: string | null = null,
  ) {
    if (!permitted || collecting) return;
    setInterruptionMessage("");
    setResumeContext(null);
    const target = catalog.find((x) => x.id === id && x.status === "available");
    if (!target || (world.collected[id] && !revisit)) {
      setPanel("browse");
      return;
    }
    setDiscoveryReturn(panel === "browse" ? "browse" : null);
    setRecommendedFrom(sourceMemory);
    setAdventureId(id);
    setSelected(`plot:${id}`);
    setDestination(destinationsFor(id)[0]);
    setNavigationStatus("");
    setPanel("discover");
  }
  function openDiscover() {
    setBrowseMode(nextExperience(world) ? "new" : "saved");
    setCategory("All keepsakes");
    setBrowsePage(0);
    setPanel("browse");
    setInterruptionMessage("");
    setResumeContext(null);
  }
  function commitWorld(next: typeof world) {
    setSaved(!protectedSave && !unresolvedRead && saveWorld(storage, next));
    setWorld(next);
  }
  function editMemory() {
    if (!permitted || !world.collected[experience.id]) return;
    commitWorld(updateMemory(world, experience.id, memoryDraft));
    setEditingMemory(false);
    setToast("");
    setNoteUpdated(true);
  }
  function add() {
    if (
      !permitted ||
      world.collected[adventure.id] ||
      collecting ||
      panel !== "arrival"
    )
      return;
    if (!muted) unlockSound();
    const next = collect(
      world,
      adventure.id,
      localVisitDate(),
      details.memory,
      destination.id,
    );
    // Save in the confirmation handler, before any reveal or lifecycle interruption.
    commitWorld(next);
    setCollectionTab("memories");
    setCollectionPage(0);
    setLastCollectedId(adventure.id);
    setPanel(null);
    setSelected(null);
    if (reducedMotion) {
      setToast("Your little world just got bigger!");
      return;
    }
    setStart(performance.now());
    setCollecting(true);
    setCollectingId(adventure.id);
    timers.current.push(
      window.setTimeout(() => {
        if (!soundMuted.current) flourish();
      }, 3600),
      window.setTimeout(() => {
        setCollecting(false);
        setCollectingId(null);
        setToast("Your little world just got bigger!");
      }, 7000),
    );
  }
  function retrySave() {
    // A failed initial read must not turn a later successful write into data loss.
    const current = readWorld(storage);
    if (current.status === "unavailable") {
      setSaved(false);
      return;
    }
    if (current.status === "corrupt" || current.status === "unsupported") {
      setProtectedSave(true);
      setUnresolvedRead(false);
      setSaved(false);
      setPanel("settings");
      return;
    }
    if (unresolvedRead && current.status === "ready") {
      setSaveConflict(current.state);
      setPanel("settings");
      return;
    }
    setUnresolvedRead(false);
    setSaved(saveWorld(storage, world));
  }
  function replaceSavedWithSession() {
    if (!permitted || !saveConflict) return;
    const success = saveWorld(storage, world);
    setSaved(success);
    if (success) {
      setUnresolvedRead(false);
      setSaveConflict(null);
    }
  }
  function restoreWorld(next: typeof world) {
    navigationRequest.current?.abort();
    navigationRequest.current = null;
    timers.current.forEach(clearTimeout);
    setWorld(next);
    setSaved(true);
    setUnresolvedRead(false);
    setSaveConflict(null);
    setProtectedSave(false);
    setPending(false);
    setSelected(null);
    setCollecting(false);
    setCollectingId(null);
    setLastCollectedId(null);
    setConfirmReset(false);
    setResetToken((token) => token + 1);
    setPanel(null);
    setToast("Your world has been restored.");
  }
  function updatePreferences(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferencesSaved(savePreferences(storage, next));
    soundMuted.current = next.muted;
    setPreferences(next);
    if (next.reducedMotion && collecting) {
      timers.current.forEach(clearTimeout);
      setCollecting(false);
      setCollectingId(null);
      setToast("Your little world just got bigger!");
    }
  }
  function reset() {
    timers.current.forEach(clearTimeout);
    const next = initialState();
    const success = saveWorld(storage, next, { replaceProtected: true });
    setSaved(success);
    if (success) {
      setUnresolvedRead(false);
      setSaveConflict(null);
    }
    setProtectedSave(false);
    setConfirmReset(false);
    setWorld(next);
    setPanel(null);
    setSelected(null);
    setCollecting(false);
    setCollectingId(null);
    setLastCollectedId(null);
    setAdventureId("mangwon");
    setCategory("All keepsakes");
    setCollectionTab("inspiration");
    setCollectionPage(0);
    setToast("A fresh little beginning.");
    setResetToken((x) => x + 1);
    setDestination(destinations[0]);
    setNavigationStatus("");
  }
  async function navigate() {
    if (navigationRequest.current || pending || !permitted) return;
    const controller = new AbortController();
    navigationRequest.current = controller;
    setPending(true);
    const reply = await requestNavigation(destination.id, controller.signal);
    if (controller.signal.aborted) return;
    navigationRequest.current = null;
    setNavigationStatus(
      reply.available
        ? "Navigation requested"
        : "Navigation is unavailable for this destination.",
    );
    setPending(false);
    setPanel("journey");
  }
  if (!permitted)
    return (
      <main className="safe-screen">
        <div className="safe-symbol">
          <Leaf size={42} />
        </div>
        <div className="eyebrow">ROAMY</div>
        <h1>Your world will be here.</h1>
        <p>
          {active
            ? safety.state === "driving"
              ? "Enjoy the journey. ROAMY is available when safely parked."
              : "Waiting for the vehicle to confirm it is safe to open your world."
            : "Your memories are kept while you use something else."}
        </p>
        <span className="mode-tag">
          {safety.state === "driving"
            ? "Driving · world paused"
            : "Vehicle safety state unavailable · world paused"}
        </span>
        <small>Your saved memories stay on this device.</small>
      </main>
    );
  return (
    <main
      className={`app ${night ? "night" : ""} ${panel ? "panel-open task-mode" : ""} ${collecting ? "collecting" : ""} ${reducedMotion ? "reduced-motion" : ""}`}
    >
      {!panel && (
        <div className="world" aria-label="Interactive miniature world">
          <RenderBoundary>
            <World
              collected={mangwon}
              collecting={collecting}
              start={start}
              night={night}
              selected={
                selected && !legacyCatalog.some((item) => item.id === selected)
                  ? selected
                  : null
              }
              onSelect={(id) => select(id)}
              resetToken={resetToken}
              zoom={zoom}
              reducedMotion={reducedMotion}
              {...{ collectedIds: currentCollectedIds, collectingId }}
            />
          </RenderBoundary>
        </div>
      )}
      <header className="topbar">
        {panel && (
          <button
            className="world-back back-button"
            aria-label={
              panel === "memory" && memoryReturn
                ? "Back to collection"
                : panel === "destinations" ||
                    panel === "journey" ||
                    (panel === "discover" &&
                      (recommendedFrom || discoveryReturn))
                  ? "Back"
                  : "Back to world"
            }
            onClick={() => {
              if (panel === "discover" && recommendedFrom) {
                select(recommendedFrom, memoryReturn);
                setRecommendedFrom(null);
                return;
              }
              if (panel === "discover" && discoveryReturn) {
                setPanel(discoveryReturn);
                return;
              }
              setPanel(
                panel === "destinations"
                  ? "discover"
                  : panel === "journey"
                    ? "destinations"
                    : panel === "memory"
                      ? memoryReturn
                      : null,
              );
            }}
          >
            <img src="./world-thumbnail.webp" alt="" />
            <ChevronLeft />
            <span className="back-full">
              {panel === "memory" && memoryReturn
                ? "Collection"
                : panel === "destinations" ||
                    panel === "journey" ||
                    (panel === "discover" &&
                      (recommendedFrom || discoveryReturn))
                  ? "Back"
                  : "Back to world"}
            </span>
            <span className="back-compact">Back</span>
          </button>
        )}
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
        >
          <span className="brand-icon">
            <Leaf size={25} strokeWidth={1.7} />
          </span>
          <span>
            ROAMY<small>DRIVE THE REAL WORLD. BUILD YOUR OWN.</small>
          </span>
        </a>
        <nav>
          {panel && (
            <button
              className="icon-button"
              aria-label="Close panel"
              onClick={() => setPanel(null)}
            >
              <X />
            </button>
          )}
          <button
            className={`nav-button collection-nav ${panel === "album" ? "active" : ""}`}
            aria-label={`Collection · ${collectionSummary}`}
            onClick={() => setPanel(panel === "album" ? null : "album")}
          >
            <BookOpen size={18} /> Collection{" "}
            <span className="count">
              <span className="demo-count">
                {confirmed.length}{" "}
                {confirmed.length === 1 ? "memory" : "memories"}
              </span>
              <span className="count-separator" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
              <span className="illustration-count">
                {illustrations.length} inspirations
              </span>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => {
              setSettingsSection("comfort");
              setPanel(panel === "settings" ? null : "settings");
            }}
          >
            <Settings2 size={28} />
            <span className="settings-label">Settings</span>
          </button>
        </nav>
      </header>
      {!panel && (
        <>
          <section className="greeting">
            <h1>What shall we add to your world today?</h1>
          </section>
          <div className="world-controls">
            <button
              aria-label="Show whole world"
              disabled={collecting}
              onClick={() => {
                setSelected(null);
                setZoom(0);
                setResetToken((x) => x + 1);
              }}
            >
              <Compass size={24} />
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => z + 1)}
              disabled={collecting}
            >
              <Plus size={20} />
            </button>
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => z - 1)}
              disabled={collecting}
            >
              <Minus size={20} />
            </button>
          </div>
          <footer className="bottom-bar">
            <div className="world-name">
              <span className="world-avatar">
                <Leaf size={20} />
              </span>
              <span>
                Your little world
                <small>
                  {collectionSummary}
                  {complete
                    ? ". This collection is complete."
                    : ". More chapters await."}
                </small>
              </span>
              <span className="saved">
                <Check size={13} />
                {saved
                  ? "Saved on this device"
                  : "Session only · storage unavailable"}
              </span>
            </div>
            <button
              className="explore-button"
              onClick={openDiscover}
              disabled={collecting}
            >
              <Compass size={20} /> {complete ? "Explore" : "Discover"}{" "}
              <ArrowUpRight size={18} />
            </button>
          </footer>
        </>
      )}
      {permitted && !panel && interruptionMessage && (
        <section className="return-banner" aria-label="Welcome back">
          <p>{interruptionMessage}</p>
          {resumeContext && (
            <button
              className="primary"
              onClick={() => {
                setSelected(resumeContext.selected);
                setPanel(resumeContext.panel);
                setMemoryDraft(resumeContext.draft);
                setEditingMemory(resumeContext.editing);
                setResumeContext(null);
                setInterruptionMessage("");
              }}
            >
              Continue browsing
              <ArrowRight />
            </button>
          )}
          <button
            className="secondary"
            onClick={() => {
              setResumeContext(null);
              setInterruptionMessage("");
            }}
          >
            Stay in my world
          </button>
        </section>
      )}
      {!saved && (
        <div className="save-warning" role="alert">
          <span>
            {protectedSave
              ? "Existing save needs attention. It has been preserved; changes are session only."
              : unresolvedRead
                ? "Saved world could not be read. It is preserved; changes are session only."
                : "Changes are session only. Saving on this device is unavailable."}
          </span>
          <button
            onClick={() => {
              if (protectedSave) setPanel("settings");
              else retrySave();
            }}
          >
            {protectedSave ? "Review save" : "Retry save"}
          </button>
        </div>
      )}
      {panel && (
        <aside
          ref={panelElement}
          tabIndex={-1}
          className={`panel ${panel === "destinations" ? "wide" : ""}`}
          data-panel={panel}
          aria-label="Adventure details"
        >
          <div className="task-content">
            {panel === "memory" && (
              <>
                <div className="memory-illustration">
                  <span aria-hidden="true">
                    <KeepsakeArt asset={experience.asset} />
                  </span>
                  <div className="postmark">
                    A MOMENT
                    <br />
                    TO KEEP
                    <Heart size={13} />
                  </div>
                </div>
                <div className="eyebrow">
                  {experience.category} ·{" "}
                  {world.collected[experience.id]?.provenance === "illustration"
                    ? "OUTING INSPIRATION"
                    : "SAVED KEEPSAKE"}
                </div>
                <h2>{experience.displayName}</h2>
                <p
                  className="memory-quote"
                  ref={memoryQuote}
                  tabIndex={-1}
                  aria-label="Memory note"
                >
                  “{world.collected[experience.id]?.memory ?? experience.memory}
                  ”
                </p>
                {noteUpdated && (
                  <p role="status" className="note-updated">
                    Memory note updated
                    {saved
                      ? " and saved on this device."
                      : " for this session only."}
                  </p>
                )}
                {recommendation && !editingMemory && (
                  <section
                    className="curated-next"
                    aria-label="Curated next chapter"
                  >
                    <a
                      className="recommendation-card"
                      href="#"
                      aria-label={`Explore ${recommendation.displayName}`}
                      onClick={(event) => {
                        event.preventDefault();
                        openExperience(recommendation.id, false, experience.id);
                      }}
                    >
                      <div className="eyebrow">UP NEXT</div>
                      <h3>{recommendation.displayName}</h3>
                      <p>{curatedReason(experience.id)}</p>
                      <ArrowRight size={28} aria-hidden="true" />
                    </a>
                  </section>
                )}
                <details className="memory-facts">
                  <summary>
                    Details
                    <span className="facts-open-icon" aria-hidden="true">
                      <Plus />
                    </span>
                    <span className="facts-close-icon" aria-hidden="true">
                      <Minus />
                    </span>
                  </summary>
                  <dl>
                    {world.collected[experience.id]?.provenance ===
                      "confirmed-demo" &&
                      !legacyCatalog.some(
                        (item) => item.id === experience.id,
                      ) && (
                        <>
                          <dt>CHOSEN CHAPTER</dt>
                          <dd className="chosen-stop">
                            {chosenDestination ? (
                              <>
                                {chosenDestination.name}
                                <small>
                                  {chosenDestination.location} · chosen by you
                                </small>
                              </>
                            ) : (
                              "No destination was recorded with this memory."
                            )}
                          </dd>
                        </>
                      )}
                    <dt>PLACE</dt>
                    <dd>{experience.venue ?? "Outing inspiration"}</dd>
                    <dt>LOCATION</dt>
                    <dd>
                      <MapPin size={14} />
                      {experience.location}
                    </dd>
                    <dt>VISIT DATE</dt>
                    <dd>
                      {world.collected[experience.id]?.visitDate ??
                        experience.visitDate}{" "}
                      ·{" "}
                      {world.collected[experience.id]?.provenance ===
                      "illustration"
                        ? "inspiration date"
                        : "date added"}
                    </dd>
                  </dl>
                </details>
                {editingMemory ? (
                  <div className="memory-editor">
                    <label htmlFor="memory-note">Memory note</label>
                    <textarea
                      id="memory-note"
                      maxLength={500}
                      value={memoryDraft}
                      onChange={(event) => setMemoryDraft(event.target.value)}
                      rows={4}
                    />
                    <p className="fine-print">
                      {memoryDraft.length}/500 characters maximum
                    </p>
                    <button className="primary" onClick={editMemory}>
                      Save note
                      <Check size={18} />
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setEditingMemory(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="secondary"
                    onClick={() => {
                      setMemoryDraft(
                        world.collected[experience.id]?.memory ??
                          experience.memory ??
                          "",
                      );
                      setNoteUpdated(false);
                      setEditingMemory(true);
                    }}
                  >
                    Edit note
                  </button>
                )}
                {!recommendation && !editingMemory && (
                  <button
                    className="primary"
                    onClick={() => setPanel("browse")}
                  >
                    Explore
                    <ArrowRight size={18} />
                  </button>
                )}
                {!editingMemory &&
                  experience.status === "available" &&
                  !legacyCatalog.some((item) => item.id === experience.id) && (
                    <button
                      className="secondary"
                      onClick={() => openExperience(experience.id, true)}
                    >
                      Revisit
                    </button>
                  )}
                <p className="fine-print">
                  {legacyCatalog.some((item) => item.id === experience.id)
                    ? "From your earlier collection. Original location and date are preserved."
                    : "A memory, never a score."}
                </p>
              </>
            )}
            {panel === "discover" && (
              <div className="adventure-preview">
                <div className="adventure-art">
                  <KeepsakeArt asset={adventure.asset} />
                </div>
                <div className="adventure-copy">
                  <div className="eyebrow">{adventure.category}</div>
                  <h2>{adventure.displayName}</h2>
                  <p>{details.description}</p>
                  <button
                    className="primary"
                    onClick={() => setPanel("destinations")}
                  >
                    Choose a place
                    <ArrowRight />
                  </button>
                </div>
              </div>
            )}
            {panel === "browse" && (
              <div className="collection-screen explore-screen">
                <div className="task-heading">
                  <div>
                    <h2>
                      {complete
                        ? "There’s a story in every keepsake."
                        : "Where to next?"}
                    </h2>
                    <p>
                      {complete
                        ? "Return to the moments you chose to keep."
                        : "Find an outing. Bring a little of it home."}
                    </p>
                  </div>
                </div>
                <div className="explore-toolbar">
                  <div
                    className="collection-tabs"
                    role="group"
                    aria-label="Explore views"
                  >
                    <button
                      aria-pressed={browseMode === "new"}
                      onClick={() => {
                        setBrowseMode("new");
                        setBrowsePage(0);
                      }}
                    >
                      New chapters
                    </button>
                    <button
                      aria-pressed={browseMode === "saved"}
                      onClick={() => {
                        setBrowseMode("saved");
                        setBrowsePage(0);
                      }}
                    >
                      Revisit
                    </button>
                  </div>
                  <label className="category-picker">
                    <span>Category</span>
                    <select
                      aria-label="Keepsake categories"
                      value={category}
                      onChange={(event) => {
                        setCategory(event.target.value as CategoryFilter);
                        setBrowsePage(0);
                      }}
                    >
                      {categories.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {complete && browseMode === "new" ? (
                  <div className="explore-complete">
                    <h3>This collection is complete.</h3>
                    <p>Your stories are still here to revisit.</p>
                    <button
                      className="primary"
                      onClick={() => setBrowseMode("saved")}
                    >
                      View memories
                      <ArrowRight />
                    </button>
                  </div>
                ) : (
                  <Shelf
                    items={catalog.filter(
                      (item) =>
                        item.status === "available" &&
                        (browseMode === "new"
                          ? !world.collected[item.id]
                          : !!world.collected[item.id]) &&
                        (category === "All keepsakes" ||
                          item.category === category),
                    )}
                    world={world}
                    page={browsePage}
                    onPage={setBrowsePage}
                    onSelect={(id) =>
                      world.collected[id]
                        ? select(id, "browse")
                        : openExperience(id)
                    }
                    label="All keepsakes"
                    discovery={browseMode === "new"}
                  />
                )}
              </div>
            )}
            {panel === "destinations" && (
              <>
                <div className="eyebrow">
                  {adventure.category === "Regional foods"
                    ? "FOLLOW YOUR APPETITE"
                    : "FOLLOW YOUR CURIOSITY"}
                </div>
                <div className="task-heading">
                  <h2>Choose a place</h2>
                  <p>{adventure.displayName}</p>
                </div>
                <div className="destinations">
                  {choices.map((d, i) => (
                    <button
                      key={d.id}
                      className={`destination ${destination.id === d.id ? "chosen" : ""}`}
                      aria-pressed={destination.id === d.id}
                      onClick={() => setDestination(d)}
                    >
                      <span className="destination-number" aria-hidden="true">
                        0{i + 1}
                      </span>
                      <span className="destination-body">
                        <small>
                          {i === 0
                            ? "A local outing"
                            : i === 1
                              ? "Take it slow"
                              : "Make a day of it"}
                        </small>
                        <strong>{d.name}</strong>
                        <span>{d.location}</span>
                      </span>
                      <span className="distance">
                        {destination.id === d.id && (
                          <>
                            <Check size={28} />
                            <span>Selected</span>
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="destination-footer">
                  <p>Outing ideas. Check place details before heading out.</p>
                  <button
                    className="primary"
                    onClick={navigate}
                    disabled={pending}
                  >
                    {pending ? "Checking navigation…" : "Let’s go"}
                    <ArrowRight size={28} />
                  </button>
                </div>
              </>
            )}
            {panel === "journey" && (
              <div className="adventure-preview">
                <div className="adventure-art journey-symbol">
                  <Compass size={120} />
                </div>
                <div className="adventure-copy">
                  <h2>{destination.name}</h2>
                  <p>{navigationStatus}</p>
                  <p>No route will start. You decide what to remember.</p>
                  <button
                    className="primary"
                    onClick={() => setPanel("arrival")}
                  >
                    Review memory
                    <ArrowRight />
                  </button>
                </div>
              </div>
            )}
            {panel === "arrival" && (
              <div className="adventure-preview">
                <div className="adventure-art">
                  <KeepsakeArt asset={adventure.asset} />
                </div>
                <div className="adventure-copy">
                  <h2>
                    {revisiting
                      ? "Already part of your world."
                      : "Keep this moment?"}
                  </h2>
                  <p className="arrival-question">
                    {revisiting ? adventure.displayName : details.question}
                  </p>
                  <p>Saved on this device, only when you choose.</p>
                  <div className="confirmation-actions">
                    {revisiting ? (
                      <button
                        className="primary"
                        onClick={() => select(adventure.id)}
                      >
                        View memory
                        <ArrowRight />
                      </button>
                    ) : (
                      <>
                        <button className="primary" onClick={add}>
                          Keep memory
                          <Plus />
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setPanel(null);
                            setToast(
                              "No hurry. Your little plot will be waiting.",
                            );
                          }}
                        >
                          Not now
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {panel === "album" && (
              <CarCollection
                {...{ world, confirmed, illustrations, archived }}
                tab={collectionTab}
                onTab={(tab) => {
                  setCollectionTab(tab);
                  setCollectionPage(0);
                }}
                page={collectionPage}
                onPage={setCollectionPage}
                onSelect={(id) => select(id, "album")}
                onDiscover={openDiscover}
              />
            )}
            {panel === "settings" && (
              <>
                <div className="task-heading">
                  <h2>Make yourself at home.</h2>
                  <p>Settings for your little world.</p>
                </div>
                <nav className="settings-tabs" aria-label="Settings sections">
                  {(
                    [
                      ["comfort", "Comfort"],
                      ["data", "Memories"],
                      ["vehicle", "Connections"],
                      ["about", "About"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      aria-current={
                        (settingsSection === "backup"
                          ? "data"
                          : settingsSection) === id
                          ? "page"
                          : undefined
                      }
                      onClick={() => setSettingsSection(id)}
                      key={id}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                {settingsSection === "comfort" && (
                  <>
                    <div className="preferences">
                      <button
                        className="secondary preference-button"
                        aria-label={
                          night ? "Switch to daytime" : "Switch to evening"
                        }
                        onClick={() => updatePreferences({ night: !night })}
                      >
                        {night ? <Sun size={22} /> : <Moon size={22} />}
                        <span>{night ? "Daytime world" : "Evening world"}</span>
                      </button>
                      <button
                        className="secondary preference-button"
                        aria-label={muted ? "Enable sound" : "Mute sound"}
                        onClick={() => {
                          updatePreferences({ muted: !muted });
                          if (muted) unlockSound();
                          else suspendSound();
                        }}
                      >
                        {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                        <span>{muted ? "Sound off" : "Sound on"}</span>
                      </button>
                      <button
                        className="secondary preference-button"
                        aria-pressed={reducedMotion}
                        onClick={() =>
                          updatePreferences({ reducedMotion: !reducedMotion })
                        }
                      >
                        <Leaf size={22} />
                        <span>Reduce motion</span>
                        <span>{reducedMotion ? "On" : "Off"}</span>
                      </button>
                    </div>
                    {!preferencesSaved && (
                      <p role="status">
                        Preferences could not be saved. These settings apply to
                        this session.
                      </p>
                    )}
                  </>
                )}
                {settingsSection === "vehicle" && (
                  <div className="settings-page">
                    <NavigationPanel permitted={permitted} />
                    <div className="settings-row">
                      <span>Cabin lighting</span>
                      <span>Unavailable</span>
                    </div>
                    <div className="settings-row">
                      <span>Vehicle safety signal</span>
                      <span>{safety.state}</span>
                    </div>
                    <div className="settings-row">
                      <span>Local save</span>
                      <span>{saved ? "Available" : "Unavailable"}</span>
                    </div>
                  </div>
                )}
                {(settingsSection === "data" ||
                  settingsSection === "backup") && (
                  <div className="settings-page">
                    {saveConflict && (
                      <div
                        className="reset-confirmation"
                        role="group"
                        aria-label="Choose saved world"
                      >
                        <h3>A saved world was found.</h3>
                        <p>
                          Your existing save has not been changed. Restore it,
                          or deliberately replace it with this session.
                          Replacement keeps a recovery copy.
                        </p>
                        <button
                          className="secondary"
                          onClick={() => restoreWorld(saveConflict)}
                        >
                          Restore saved world
                        </button>
                        <button
                          className="secondary"
                          onClick={replaceSavedWithSession}
                        >
                          Replace with this session
                        </button>
                        <button
                          className="secondary"
                          onClick={() => setSaveConflict(null)}
                        >
                          Keep session without saving
                        </button>
                      </div>
                    )}
                    {settingsSection === "data" && (
                      <button
                        className="secondary settings-tile"
                        onClick={() => setSettingsSection("backup")}
                      >
                        <BookOpen />
                        Backup and recovery
                        <ArrowRight />
                      </button>
                    )}
                    {settingsSection === "backup" && (
                      <>
                        <button
                          className="secondary"
                          onClick={() => setSettingsSection("data")}
                        >
                          <ChevronLeft />
                          Memories settings
                        </button>
                        <BackupPanel
                          world={world}
                          storage={storage}
                          config={persistenceConfig}
                          onRestore={restoreWorld}
                        />
                      </>
                    )}
                    {settingsSection === "data" && (
                      <>
                        {confirmReset ? (
                          <div
                            className="reset-confirmation"
                            role="group"
                            aria-label="Confirm world reset"
                          >
                            <p>
                              This replaces the saved world on this device. Your
                              added memories will be removed. A recovery copy is
                              kept until you clear it in Backup and recovery.
                            </p>
                            <button
                              className="secondary"
                              onClick={() => setConfirmReset(false)}
                            >
                              Keep my world
                            </button>
                            <button
                              className="secondary reset-button"
                              onClick={reset}
                            >
                              Confirm reset
                            </button>
                          </div>
                        ) : (
                          <button
                            className="secondary reset-button"
                            onClick={() => setConfirmReset(true)}
                          >
                            <RotateCcw size={18} />
                            Reset my world
                          </button>
                        )}
                        <p className="fine-print">
                          Start a fresh collection on this device. A recovery
                          copy keeps your previous world available.
                        </p>
                      </>
                    )}
                  </div>
                )}
                {settingsSection === "about" && (
                  <div className="settings-page">
                    <h3>ROAMY</h3>
                    <p>Drive the real world. Build your own.</p>
                    <ThirdPartyNotices />
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      )}
      {collecting && (
        <div className="collection-caption" role="status">
          <Sparkles size={20} />
          <span>A little memory is finding its home…</span>
          <div className="collection-progress" />
        </div>
      )}
      {toast && !collecting && (
        <div className="toast" role="status">
          <span className="toast-icon">
            <Heart size={21} />
          </span>
          <span>
            {toast}
            <small>
              {lastCollectedId
                ? `${catalog.find((item) => item.id === lastCollectedId)?.displayName} · a memory to keep`
                : "The world is yours to wander."}
            </small>
          </span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </main>
  );
}
