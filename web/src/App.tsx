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
import {
  canInteract,
  catalog,
  collect,
  destinations,
  initialState,
  readWorld,
  recommend,
  saveWorld,
  type Destination,
  type Safety,
} from "./domain";
import { nativeHost, parseSafety, requestNavigation } from "./bridge";
import { flourish, suspendSound, unlockSound } from "./sound";
import "./styles.css";
import "./vehicle.css";
const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
};
type Panel =
  | "memory"
  | "discover"
  | "destinations"
  | "journey"
  | "arrival"
  | "album"
  | "settings"
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
  const [protectedSave, setProtectedSave] = useState(
    loaded.status === "corrupt" || loaded.status === "unsupported",
  );
  const [panel, setPanel] = useState<Panel>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [night, setNight] = useState(false),
    [muted, setMuted] = useState(false),
    [zoom, setZoom] = useState(0);
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
  const chicago = Boolean(world.collected.chicago);
  const experience = catalog.find((x) => x.id === selected) ?? catalog[0];
  const count = Object.keys(world.collected).length;
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
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      navigationRequest.current?.abort();
    },
    [],
  );
  function select(id: string) {
    if (!permitted || collecting) return;
    if (!id) {
      setSelected(null);
      return;
    }
    setSelected(id);
    setPanel(id === "plot" ? "discover" : "memory");
    if (!muted) unlockSound();
  }
  function openDiscover() {
    setSelected("plot");
    setPanel("discover");
  }
  function add() {
    if (!permitted || chicago || collecting || panel !== "arrival") return;
    if (!muted) unlockSound();
    const next = collect(
      world,
      "chicago",
      new Date().toISOString().slice(0, 10),
      "A new chapter in our great pizza debate.",
    );
    // Save in the confirmation handler, before any reveal or lifecycle interruption.
    setSaved(!protectedSave && saveWorld(storage, next));
    setWorld(next);
    setPanel(null);
    setSelected(null);
    setStart(performance.now());
    setCollecting(true);
    timers.current.push(
      window.setTimeout(() => {
        if (!muted) flourish();
      }, 3600),
      window.setTimeout(() => {
        setCollecting(false);
        setToast("Your little world just got bigger!");
      }, 7000),
    );
  }
  function reset() {
    timers.current.forEach(clearTimeout);
    const next = initialState();
    setSaved(saveWorld(storage, next));
    setProtectedSave(false);
    setConfirmReset(false);
    setWorld(next);
    setPanel(null);
    setSelected(null);
    setCollecting(false);
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
        <div className="eyebrow">LITTLE WORLD</div>
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
      className={`app ${night ? "night" : ""} ${panel ? "panel-open" : ""} ${collecting ? "collecting" : ""}`}
    >
      <div className="world" aria-label="Interactive miniature world">
        <RenderBoundary>
          <World
            collected={chicago}
            collecting={collecting}
            start={start}
            night={night}
            selected={selected}
            onSelect={select}
            resetToken={resetToken}
            zoom={zoom}
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
            LITTLE WORLD<small>DRIVE THE REAL WORLD. BUILD YOUR OWN.</small>
          </span>
        </a>
        <nav>
          <span className="preview-tag">
            <span />{" "}
            {nativeHost
              ? "Non-vehicle development preview"
              : "Browser development preview"}
          </span>
          <button
            className={`nav-button ${panel === "album" ? "active" : ""}`}
            onClick={() => setPanel(panel === "album" ? null : "album")}
          >
            <BookOpen size={18} /> My collection{" "}
            <span className="count">{count}</span>
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
        <h1>What shall we add to our little world today?</h1>
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
            Our little corner of the world
            <small>{count} memories made. So many more to come.</small>
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
          <Compass size={20} /> Find a little adventure{" "}
          <ArrowUpRight size={18} />
        </button>
      </footer>
      {!saved && (
        <div className="save-warning" role="alert">
          <span>
            {protectedSave
              ? "Existing save needs attention. It has been preserved; changes are session only."
              : "Changes are session only. Saving on this device is unavailable."}
          </span>
          <button
            onClick={() => {
              if (protectedSave) setPanel("settings");
              else setSaved(saveWorld(storage, world));
            }}
          >
            {protectedSave ? "Review save" : "Retry save"}
          </button>
        </div>
      )}
      {panel && (
        <aside
          className={`panel ${panel === "destinations" ? "wide" : ""}`}
          aria-label="Adventure details"
        >
          <div className="panel-top">
            <button
              className="back-button"
              onClick={() =>
                setPanel(
                  panel === "destinations"
                    ? "discover"
                    : panel === "journey"
                      ? "destinations"
                      : null,
                )
              }
            >
              <ChevronLeft size={17} />
              {panel === "destinations"
                ? "The next keepsake"
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
                <span>
                  {experience.asset === "detroit"
                    ? "🍕"
                    : experience.asset === "lighthouse"
                      ? "⚓"
                      : experience.asset === "cherry"
                        ? "❀"
                        : experience.asset === "chicago"
                          ? "🍕"
                          : "☕"}
                </span>
                <div className="postmark">
                  A MOMENT
                  <br />
                  TO KEEP
                  <Heart size={13} />
                </div>
              </div>
              <div className="eyebrow">{experience.category} · DEMO MEMORY</div>
              <h2>{experience.displayName}</h2>
              <p className="memory-quote">
                “{world.collected[experience.id]?.memory ?? experience.memory}”
              </p>
              <dl>
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
                  · sample memory
                </dd>
              </dl>
              {recommend(experience.id, world) && (
                <div className="next-note">
                  <Sparkles size={18} />
                  <p>
                    {experience.id === "detroit"
                      ? "You’ve tried Detroit-style pizza. Ready to settle the great pizza debate?"
                      : `Your world is dreaming of ${recommend(experience.id, world)!.displayName.toLowerCase()}.`}
                  </p>
                </div>
              )}
              {experience.id === "detroit" && !chicago ? (
                <button className="primary" onClick={openDiscover}>
                  Meet your next keepsake
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button className="primary" onClick={() => setPanel("album")}>
                  Explore your collection
                  <ArrowRight size={18} />
                </button>
              )}
              <p className="fine-print">
                Illustrative demo data. A memory, never a score.
              </p>
            </>
          )}
          {panel === "discover" && (
            <>
              <div className="eyebrow">A SPACE FOR SOMETHING WONDERFUL</div>
              <h2>
                {chicago ? "Where to next?" : "A bigger slice of adventure."}
              </h2>
              {!chicago ? (
                <>
                  <div className="shop-preview">
                    <RenderBoundary>
                      <ShopPreview />
                    </RenderBoundary>
                    <span className="preview-caption">YOUR NEXT KEEPSAKE</span>
                  </div>
                  <div className="keepsake-title">
                    <h3>Chicago deep-dish pizza</h3>
                    <span>Regional foods</span>
                  </div>
                  <p>
                    A golden crust. A wonderfully deep filling. A new little
                    gathering place for your world.
                  </p>
                  <div className="next-note">
                    <Heart size={18} />
                    <p>
                      You’ve tried Detroit-style pizza. Ready to settle the
                      great pizza debate?
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setPanel("destinations")}
                  >
                    Find deep-dish pizza
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <div className="future-stamp">
                    NY<span>A slice of possibility</span>
                  </div>
                  <h3>New York-style pizza</h3>
                  <p>
                    The next chapter in your pizza story. This catalog preview
                    is waiting for a future adventure.
                  </p>
                  <button className="primary" onClick={() => setPanel("album")}>
                    See your keepsakes
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
              <p className="fine-print">
                No rush. Your next adventure will find its moment.
              </p>
            </>
          )}
          {panel === "destinations" && (
            <>
              <div className="eyebrow">FOLLOW YOUR APPETITE</div>
              <h2>
                How far does
                <br />
                curiosity take you?
              </h2>
              <p>Three little possibilities for your next big bite.</p>
              <div className="demo-notice">
                DEMO DESTINATIONS · SAMPLE DISTANCES
                <br />
                <span>
                  Illustrative venues. No live availability or route data.
                </span>
              </div>
              <div className="destinations">
                {destinations.map((d, i) => (
                  <button
                    key={d.id}
                    className={`destination ${destination.id === d.id ? "chosen" : ""}`}
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
                🍕
                <span>
                  <Check size={22} />
                </span>
              </div>
              <div className="eyebrow">SIMULATED ARRIVAL</div>
              <h2>
                One delicious
                <br />
                new memory?
              </h2>
              <p className="arrival-question">
                Did you try Chicago deep-dish pizza?
              </p>
              <p>A keepsake belongs in your world only when you say it does.</p>
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
              <p>Every keepsake has a story. Here are yours.</p>
              <div className="album">
                {catalog
                  .filter((x) => world.collected[x.id])
                  .map((x, i) => (
                    <button key={x.id} onClick={() => select(x.id)}>
                      <span className={`album-icon asset-${x.asset}`}>
                        {["🍕", "⚓", "❀", "☕", "🍕"][i]}
                      </span>
                      <span>
                        <strong>{x.displayName}</strong>
                        <small>{world.collected[x.id].visitDate} · demo</small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  ))}
              </div>
              <p className="fine-print">
                Saved locally on this device. No account needed.
              </p>
            </>
          )}
          {panel === "settings" && (
            <>
              <div className="eyebrow">BEHIND THE LITTLE WORLD</div>
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
                  onClick={() => setNight((n) => !n)}
                >
                  {night ? <Sun size={22} /> : <Moon size={22} />}
                  <span>{night ? "Daytime world" : "Evening world"}</span>
                </button>
                <button
                  className="secondary preference-button"
                  aria-label={muted ? "Enable sound" : "Mute sound"}
                  onClick={() => {
                    setMuted((m) => !m);
                    if (muted) unlockSound();
                    else suspendSound();
                  }}
                >
                  {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  <span>{muted ? "Sound off" : "Sound on"}</span>
                </button>
              </div>
              <div className="settings-row">
                <span>Navigation</span>
                <span>Demo adapter</span>
              </div>
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
              {confirmReset ? (
                <div
                  className="reset-confirmation"
                  role="group"
                  aria-label="Confirm world reset"
                >
                  <p>
                    This replaces the saved world on this device. Your added
                    memories will be removed.
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
              {chicago
                ? "Chicago deep-dish pizza · a memory to keep"
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
