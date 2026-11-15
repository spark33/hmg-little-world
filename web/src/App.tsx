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
import World, { ShopPreview } from "./World";
import { collectionGroups, curatedReason } from "./journeys";
import { KeepsakeIcon } from "./KeepsakeIcon";
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
  const [safety, setSafety] = useState<Safety>({
    state: "unknown",
    preview: !nativeHost,
  });
  const [active, setActive] = useState(!document.hidden);
  const permitted = canInteract(safety) && active;
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
  const collectionSummary = `${confirmed.length} confirmed demo${confirmed.length === 1 ? "" : "s"} · ${illustrations.length} illustrations`;
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
    const safetyListener = (event: Event) => {
      const value = parseSafety((event as CustomEvent).detail);
      if (value) {
        if (!canInteract(value)) navigationRequest.current?.abort();
        setSafety(value);
      }
    };
    const visible = () => {
      setActive(!document.hidden);
      if (document.hidden) {
        navigationRequest.current?.abort();
        suspendSound();
      }
    };
    window.addEventListener("vehicle-safety", safetyListener);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("vehicle-safety", safetyListener);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!permitted) {
      timers.current.forEach(clearTimeout);
      setCollecting(false);
      setCollectingId(null);
      setEditingMemory(false);
      setSaveConflict(null);
      setPanel(null);
      setToast("");
      setPending(false);
      setConfirmReset(false);
      suspendSound();
    }
  }, [permitted]);
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
    const target = catalog.find((x) => x.id === id && x.status === "available");
    if (!target || (world.collected[id] && !revisit)) {
      setPanel("browse");
      return;
    }
    setRecommendedFrom(sourceMemory);
    setAdventureId(id);
    setSelected(`plot:${id}`);
    setDestination(destinationsFor(id)[0]);
    setNavigationStatus("");
    setPanel("discover");
  }
  function openDiscover() {
    const next = nextExperience(world);
    if (next) openExperience(next.id);
    else setPanel("browse");
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
        : "Live navigation is unavailable. This is a sample destination.",
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
        <h1>Your little world can wait.</h1>
        <p>
          {active
            ? "The interactive world is available only with a trusted parked signal."
            : "Your world is resting while the app is in the background."}
        </p>
        <span className="mode-tag">
          {safety.state === "driving"
            ? "Driving · world paused"
            : "Vehicle safety state unavailable · world paused"}
        </span>
        <small>There is no driving-mode override.</small>
      </main>
    );
  return (
    <main
      className={`app ${night ? "night" : ""} ${panel ? "panel-open" : ""} ${collecting ? "collecting" : ""} ${reducedMotion ? "reduced-motion" : ""}`}
    >
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
      <header className="topbar">
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
          <span className="preview-tag">
            <span />{" "}
            {nativeHost
              ? safety.preview
                ? "Non-vehicle development preview"
                : "Parked vehicle"
              : "Browser development preview"}
          </span>
          <button
            className={`nav-button ${panel === "album" ? "active" : ""}`}
            aria-label={`My collection · ${collectionSummary}`}
            onClick={() => setPanel(panel === "album" ? null : "album")}
          >
            <BookOpen size={18} /> My collection{" "}
            <span className="count">
              <span className="demo-count">
                {confirmed.length} demo{confirmed.length === 1 ? "" : "s"}
              </span>
              <span className="count-separator" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
              <span className="illustration-count">
                {illustrations.length} illustrations
              </span>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label="Demo settings"
            onClick={() => setPanel(panel === "settings" ? null : "settings")}
          >
            <Settings2 size={20} />
          </button>
        </nav>
      </header>
      <section className="greeting">
        <h1>What shall we add to our Seoul world today?</h1>
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
            Our little corner of Seoul
            <small>
              {collectionSummary}
              {complete
                ? ". Your demo collection is complete."
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
          <Compass size={20} />{" "}
          {complete ? "Explore all keepsakes" : "Find a little adventure"}{" "}
          <ArrowUpRight size={18} />
        </button>
      </footer>
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
          aria-label="Adventure details"
        >
          <div className="panel-top">
            <button
              className="back-button"
              onClick={() => {
                if (panel === "discover" && recommendedFrom) {
                  select(recommendedFrom, memoryReturn);
                  setRecommendedFrom(null);
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
              <ChevronLeft size={17} />
              {panel === "destinations"
                ? "The next keepsake"
                : panel === "discover" && recommendedFrom
                  ? "Source memory"
                  : panel === "memory" && memoryReturn === "album"
                    ? "My collection"
                    : panel === "memory" && memoryReturn === "browse"
                      ? "All keepsakes"
                      : "Your little world"}
            </button>
            <button
              className="icon-button"
              aria-label="Close panel"
              onClick={() => setPanel(null)}
            >
              <X size={19} />
            </button>
          </div>
          {panel === "memory" && (
            <>
              <div className="memory-illustration">
                <span aria-hidden="true">
                  <KeepsakeIcon asset={experience.asset} />
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
                  ? "ILLUSTRATIVE MEMORY"
                  : "CONFIRMED DEMO KEEPSAKE"}
              </div>
              <h2>{experience.displayName}</h2>
              <p
                className="memory-quote"
                ref={memoryQuote}
                tabIndex={-1}
                aria-label="Memory note"
              >
                “{world.collected[experience.id]?.memory ?? experience.memory}”
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
                  <div className="eyebrow">CURATED NEXT CHAPTER</div>
                  <h3>{recommendation.displayName}</h3>
                  <p>{curatedReason(experience.id)}</p>
                </section>
              )}
              <dl>
                {world.collected[experience.id]?.provenance ===
                  "confirmed-demo" &&
                  !legacyCatalog.some((item) => item.id === experience.id) && (
                    <>
                      <dt>CHOSEN ILLUSTRATIVE STOP</dt>
                      <dd className="chosen-stop">
                        {chosenDestination ? (
                          <>
                            {chosenDestination.name}
                            <small>
                              {chosenDestination.location} · demo choice, not a
                              verified visit
                            </small>
                          </>
                        ) : (
                          "Not recorded in this earlier demo memory. No stop is inferred."
                        )}
                      </dd>
                    </>
                  )}
                <dt>PLACE</dt>
                <dd>{experience.venue ?? "Illustrative sample experience"}</dd>
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
                  {world.collected[experience.id]?.provenance === "illustration"
                    ? "illustrative date"
                    : "demo confirmation date"}
                </dd>
              </dl>
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
                    Save memory
                    <Check size={18} />
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setEditingMemory(false)}
                  >
                    Cancel editing
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
                  Edit memory note
                </button>
              )}
              {recommendation && !editingMemory && (
                <>
                  <button
                    className="primary"
                    onClick={() =>
                      openExperience(recommendation.id, false, experience.id)
                    }
                  >
                    {`Discover ${recommendation.displayName}`}
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
              {!recommendation && !editingMemory && (
                <button className="primary" onClick={() => setPanel("browse")}>
                  Explore all keepsakes
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
                    Revisit demo adventure
                  </button>
                )}
              <p className="fine-print">
                {legacyCatalog.some((item) => item.id === experience.id)
                  ? "Archived from an earlier demo world. Original location and date are preserved; this is not a Seoul visit."
                  : "Illustrative Seoul demo data. A memory, never a score."}
              </p>
            </>
          )}
          {panel === "discover" && (
            <>
              <div className="eyebrow">A SPACE FOR SOMETHING WONDERFUL</div>
              <h2>
                {adventure.id === "mangwon"
                  ? "A little taste of Seoul."
                  : adventure.displayName}
              </h2>
              <div className="shop-preview">
                <RenderBoundary>
                  <ShopPreview {...{ asset: adventure.asset }} />
                </RenderBoundary>
                <span className="preview-caption">
                  {revisiting ? "A MEMORY TO REVISIT" : "YOUR NEXT KEEPSAKE"}
                </span>
              </div>
              <div className="keepsake-title">
                <h3>{adventure.displayName}</h3>
                <span>{adventure.category}</span>
              </div>
              <p>{details.description}</p>
              <div className="next-note">
                <Heart size={18} />
                <p>
                  {adventure.id === "mangwon"
                    ? "Inspired by the Gwangjang market illustration: imagine a Mangwon Market picnic next. No real visit is verified."
                    : "A new place in your world, only after you confirm the memory."}
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setPanel("destinations")}
              >
                {details.findLabel}
                <ArrowRight size={18} />
              </button>

              <button className="secondary" onClick={() => setPanel("browse")}>
                Browse all keepsakes
              </button>
              <p className="fine-print">
                Illustrative demo experience. No real venue, visit or arrival is
                verified.
              </p>
            </>
          )}
          {panel === "browse" && (
            <>
              <div className="eyebrow">A LITTLE WORLD OF POSSIBILITIES</div>
              <h2>
                {complete
                  ? "Every little chapter, together."
                  : "Find your next keepsake."}
              </h2>
              <div className="collection-progress-summary">
                <p>
                  {confirmedCount} of {collectibleIds.length} demo keepsakes
                  confirmed · 4 illustrative memories
                </p>
                <progress
                  value={confirmedCount}
                  max={collectibleIds.length}
                  aria-label="Confirmed demo keepsakes"
                />
              </div>
              {complete && (
                <div className="completion-card" role="status">
                  <Sparkles size={24} />
                  <h3>Your demo collection is complete.</h3>
                  <p>
                    All four new keepsakes have a home. Revisit their stories,
                    edit your notes, or explore a different view of your island.
                  </p>
                </div>
              )}
              <div
                className="catalog-filters"
                role="group"
                aria-label="Keepsake categories"
              >
                {categories.map((item) => (
                  <button
                    key={item}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="keepsake-grid">
                {catalog
                  .filter(
                    (item) =>
                      category === "All keepsakes" ||
                      item.category === category,
                  )
                  .map((item) => {
                    const record = world.collected[item.id];
                    return (
                      <button
                        key={item.id}
                        className="keepsake-card"
                        onClick={() =>
                          record
                            ? select(item.id, "browse")
                            : openExperience(item.id)
                        }
                      >
                        <span
                          className={`album-icon asset-${item.asset}`}
                          aria-hidden="true"
                        >
                          <KeepsakeIcon asset={item.asset} />
                        </span>
                        <span>
                          <strong>{item.displayName}</strong>
                          <small>{item.category}</small>
                          <span className="keepsake-state">
                            {record
                              ? record.provenance === "illustration"
                                ? "Illustrative memory"
                                : "Collected demo keepsake"
                              : "Available demo keepsake"}
                          </span>
                        </span>
                        <ArrowUpRight size={18} />
                      </button>
                    );
                  })}
              </div>
              <p className="fine-print">
                Four reserved plots grow through your confirmed demo
                experiences. Time and driving do not unlock or add keepsakes.
              </p>
            </>
          )}
          {panel === "destinations" && (
            <>
              <div className="eyebrow">
                {adventure.category === "Regional foods"
                  ? "FOLLOW YOUR APPETITE"
                  : "FOLLOW YOUR CURIOSITY"}
              </div>
              <h2>
                How far does
                <br />
                curiosity take you?
              </h2>
              <p>
                Three illustrative possibilities for{" "}
                {adventure.displayName.toLowerCase()}.
              </p>
              <div className="demo-notice">
                DEMO DESTINATIONS · SAMPLE DISTANCES
                <br />
                <span>
                  Illustrative venues. No live availability or route data.
                </span>
              </div>
              <div className="destinations">
                {choices.map((d, i) => (
                  <button
                    key={d.id}
                    className={`destination ${destination.id === d.id ? "chosen" : ""}`}
                    aria-pressed={destination.id === d.id}
                    onClick={() => setDestination(d)}
                  >
                    <span className="destination-number">0{i + 1}</span>
                    <span className="destination-body">
                      <small>{d.kind}</small>
                      <strong>{d.name}</strong>
                      <span>{d.location}</span>
                      <em>{d.description}</em>
                    </span>
                    <span className="distance">
                      {d.distance}
                      <small>sample</small>
                      {destination.id === d.id && <Check size={16} />}
                    </span>
                  </button>
                ))}
              </div>
              <button className="primary" onClick={navigate} disabled={pending}>
                {pending ? "Checking navigation…" : "Let’s go"}
                <ArrowRight size={18} />
              </button>
            </>
          )}
          {panel === "journey" && (
            <>
              <div className="journey-art">
                <Compass size={80} strokeWidth={1} />
                <span>⋯</span>
                <MapPin size={38} strokeWidth={1.4} />
              </div>
              <div className="eyebrow">A LITTLE ADVENTURE AWAITS</div>
              <h2>{destination.name}</h2>
              <p>{destination.location}</p>
              <div className="next-note">
                <MapPin size={20} />
                <p>{navigationStatus}</p>
              </div>
              <p>
                This development preview can simulate the journey and arrival.
                No real route will start.
              </p>
              <button className="primary" onClick={() => setPanel("arrival")}>
                Simulate journey
                <ArrowRight size={18} />
              </button>
              <p className="fine-print">
                SIMULATED TRAVEL · NO VEHICLE CONTROL
              </p>
            </>
          )}
          {panel === "arrival" && (
            <>
              <div className="arrival-art">
                <KeepsakeIcon asset={adventure.asset} />
                <span>
                  <Check size={22} />
                </span>
              </div>
              <div className="eyebrow">SIMULATED ARRIVAL</div>
              <h2>
                {revisiting ? (
                  "A familiar little chapter."
                ) : adventure.category === "Regional foods" ? (
                  <>
                    One delicious
                    <br />
                    new memory?
                  </>
                ) : (
                  <>
                    One wonderful
                    <br />
                    new memory?
                  </>
                )}
              </h2>
              <p className="arrival-question">{details.question}</p>
              <p>A keepsake belongs in your world only when you say it does.</p>
              {revisiting ? (
                <>
                  <p>
                    This keepsake is already in your world. Replaying a demo
                    never duplicates it or changes its original confirmation.
                  </p>
                  <button
                    className="primary"
                    onClick={() => select(adventure.id)}
                  >
                    Return to this memory
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button className="primary" onClick={add}>
                    Add to my world
                    <Plus size={19} />
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setPanel(null);
                      setToast("No hurry. Your little plot will be waiting.");
                    }}
                  >
                    Not yet
                  </button>
                </>
              )}
              <p className="fine-print">
                This confirmation records an illustrative demo experience.
              </p>
            </>
          )}
          {panel === "album" && (
            <>
              <div className="eyebrow">THE PLACES WE CARRY WITH US</div>
              <h2>
                A world of
                <br />
                little memories.
              </h2>
              <p>
                Your confirmed demo chapters and the illustrations that started
                this world, kept clearly separate.
              </p>
              {[
                {
                  title: "Confirmed demo keepsakes",
                  items: confirmed,
                  empty:
                    "No demo confirmations yet. Choose an illustrative adventure to start your own demo chapter.",
                },
                {
                  title: "Seeded illustrations",
                  items: illustrations,
                  empty: "No seeded illustrations in this world.",
                },
              ].map((group) => (
                <section
                  className="collection-group"
                  key={group.title}
                  aria-label={group.title}
                >
                  <h3>{group.title}</h3>
                  <p>
                    {group.title === "Confirmed demo keepsakes"
                      ? "Newest confirmation dates first. Demo confirmations are not verified visits."
                      : "Examples supplied with the world, not places you have visited."}
                  </p>
                  {group.items.length === 0 ? (
                    <p>{group.empty}</p>
                  ) : (
                    <div className="album">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => select(item.id, "album")}
                        >
                          <span className={`album-icon asset-${item.asset}`}>
                            <KeepsakeIcon asset={item.asset} />
                          </span>
                          <span>
                            <strong>{item.displayName}</strong>
                            <small>
                              {world.collected[item.id].visitDate} ·{" "}
                              {world.collected[item.id].provenance ===
                              "illustration"
                                ? "illustration"
                                : "confirmed demo"}
                            </small>
                          </span>
                          <ArrowUpRight size={18} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {archived.length > 0 && (
                <section
                  className="legacy-collection"
                  aria-label="Earlier demo memories"
                >
                  <h3>Earlier demo memories</h3>
                  <p>
                    {archived.length} archived memories keep their original
                    names, dates, and places. They do not count as Seoul visits.
                  </p>
                  <div className="album">
                    {archived.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => select(item.id, "album")}
                      >
                        <span
                          className={`album-icon asset-${item.asset}`}
                          aria-hidden="true"
                        >
                          <KeepsakeIcon asset={item.asset} />
                        </span>
                        <span>
                          <strong>{item.displayName}</strong>
                          <small>
                            {world.collected[item.id].visitDate} ·{" "}
                            {world.collected[item.id].provenance ===
                            "illustration"
                              ? "earlier illustration"
                              : "earlier confirmed demo"}
                          </small>
                        </span>
                        <ArrowUpRight size={18} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <button className="secondary" onClick={() => setPanel("browse")}>
                Browse all keepsakes
              </button>
              <p className="fine-print">
                Saved locally on this device. No account needed.
              </p>
            </>
          )}
          {panel === "settings" && (
            <>
              <div className="eyebrow">BEHIND ROAMY</div>
              <h2>
                A place to
                <br />
                try the magic.
              </h2>
              <p>
                This is an explicitly identified non-vehicle development
                preview. Vehicle state, live routes, and cabin lighting are
                unavailable.
              </p>
              <div className="preferences">
                <button
                  className="secondary preference-button"
                  aria-label={night ? "Switch to daytime" : "Switch to evening"}
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
                  Preferences could not be saved. These settings apply to this
                  session.
                </p>
              )}
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
              {saveConflict && (
                <div
                  className="reset-confirmation"
                  role="group"
                  aria-label="Choose saved world"
                >
                  <h3>A saved world was found.</h3>
                  <p>
                    Your existing save has not been changed. Restore it, or
                    deliberately replace it with this session. Replacement keeps
                    a recovery copy.
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
              <BackupPanel
                world={world}
                storage={storage}
                config={persistenceConfig}
                onRestore={restoreWorld}
              />
              <ThirdPartyNotices />
              {confirmReset ? (
                <div
                  className="reset-confirmation"
                  role="group"
                  aria-label="Confirm world reset"
                >
                  <p>
                    This replaces the saved world on this device. Your added
                    memories will be removed. A recovery copy is kept until you
                    clear it in Backup and recovery.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setConfirmReset(false)}
                  >
                    Keep my world
                  </button>
                  <button className="secondary reset-button" onClick={reset}>
                    Confirm reset
                  </button>
                </div>
              ) : (
                <button
                  className="secondary reset-button"
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw size={18} />
                  Reset demo world
                </button>
              )}
              <p className="fine-print">
                Resets only this device’s demo collection so you can replay the
                full arrival moment.
              </p>
            </>
          )}
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
