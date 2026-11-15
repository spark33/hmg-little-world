import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { type Experience, type WorldState } from "./domain";
import { KeepsakeArt } from "./KeepsakeArt";

export type CollectionTab = "memories" | "inspiration" | "earlier";
export function useShelfSize() {
  const size = () =>
    window.innerWidth >= 1200 ? 4 : window.innerWidth >= 700 ? 2 : 1;
  const [count, setCount] = useState(size);
  useEffect(() => {
    const resize = () => setCount(size());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return count;
}
export function Shelf({
  items,
  world,
  page,
  onPage,
  onSelect,
  label,
  discovery = false,
}: {
  items: Experience[];
  world: WorldState;
  page: number;
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
  label: string;
  discovery?: boolean;
}) {
  const size = useShelfSize();
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return (
    <>
      <div
        className={`car-shelf ${discovery ? "discovery-shelf" : ""}`}
        role="region"
        aria-label={label}
        style={
          {
            "--shelf-columns": Math.min(size, Math.max(items.length, 1)),
          } as React.CSSProperties
        }
      >
        {items.slice(current * size, (current + 1) * size).map((item) => {
          const record = world.collected[item.id];
          return (
            <button
              className="shelf-item"
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <KeepsakeArt asset={item.asset} />
              <strong>{item.displayName}</strong>
              <span className="shelf-date">
                {record
                  ? record.provenance === "illustration"
                    ? "Outing inspiration"
                    : record.visitDate
                  : item.category}
              </span>
              <span className="shelf-affordance" aria-hidden="true">
                <ArrowRight size={28} />
              </span>
            </button>
          );
        })}
        {!items.length && (
          <div className="shelf-empty">
            <h3>Your next memory belongs here.</h3>
            <p>Choose an adventure, then keep the moment when you are ready.</p>
          </div>
        )}
      </div>
      {pages > 1 && (
        <nav className="shelf-pagination" aria-label="Collection pages">
          <button
            className="secondary"
            disabled={current === 0}
            onClick={() => onPage(current - 1)}
            aria-label="Previous keepsakes"
          >
            <ChevronLeft />
            <span className="pagination-label">Previous</span>
          </button>
          <span role="status">
            {current + 1} of {pages}
          </span>
          <button
            className="secondary"
            disabled={current === pages - 1}
            onClick={() => onPage(current + 1)}
            aria-label="Next keepsakes"
          >
            <span className="pagination-label">Next</span>
            <ChevronRight />
          </button>
        </nav>
      )}
    </>
  );
}
export default function CarCollection({
  world,
  confirmed,
  illustrations,
  archived,
  tab,
  onTab,
  page,
  onPage,
  onSelect,
  onDiscover,
}: {
  world: WorldState;
  confirmed: Experience[];
  illustrations: Experience[];
  archived: Experience[];
  tab: CollectionTab;
  onTab: (tab: CollectionTab) => void;
  page: number;
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
  onDiscover: () => void;
}) {
  const items =
    tab === "memories"
      ? confirmed
      : tab === "earlier"
        ? archived
        : illustrations;
  return (
    <div className="collection-screen">
      <div className="task-heading">
        <h2>Collection</h2>
        <p>
          {tab === "memories"
            ? "The moments you chose to keep."
            : tab === "earlier"
              ? "Your original places and stories, kept together."
              : "A little inspiration for your next outing."}
        </p>
      </div>
      <div
        className="collection-tabs"
        role="tablist"
        aria-label="Collection views"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="tab"]',
            ),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          buttons[next]?.click();
          buttons[next]?.focus();
        }}
      >
        <button
          role="tab"
          aria-selected={tab === "memories"}
          tabIndex={tab === "memories" ? 0 : -1}
          onClick={() => onTab("memories")}
        >
          My memories <span>{confirmed.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "inspiration"}
          tabIndex={tab === "inspiration" ? 0 : -1}
          onClick={() => onTab("inspiration")}
        >
          Inspiration
        </button>
        {archived.length > 0 && (
          <button
            role="tab"
            aria-selected={tab === "earlier"}
            tabIndex={tab === "earlier" ? 0 : -1}
            onClick={() => onTab("earlier")}
          >
            Earlier memories
          </button>
        )}
      </div>
      <Shelf
        {...{ items, world, page, onPage, onSelect }}
        label={
          tab === "memories"
            ? "Saved keepsakes"
            : tab === "earlier"
              ? "Earlier memories"
              : "Outing inspiration"
        }
      />
      {tab === "memories" && !items.length && (
        <button className="primary empty-discover" onClick={onDiscover}>
          Discover
          <ArrowRight />
        </button>
      )}
    </div>
  );
}
