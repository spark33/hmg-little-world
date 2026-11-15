export type AssetType =
  | "detroit"
  | "chicago"
  | "new-york"
  | "lighthouse"
  | "cherry"
  | "cafe"
  | "mountain"
  | "museum";
export interface Experience {
  id: string;
  category: "Regional foods" | "Nature" | "Landmarks" | "Cultural experiences";
  displayName: string;
  location: string;
  venue?: string;
  status: "collected" | "available";
  visitDate?: string;
  memory?: string;
  asset: AssetType;
  visual: { color: string };
  suggestions: string[];
}
export const catalog: Experience[] = [
  {
    id: "detroit",
    category: "Regional foods",
    displayName: "Detroit-style pizza",
    location: "Detroit, Michigan",
    venue: "Demo Detroit pizza restaurant",
    status: "collected",
    visitDate: "2026-06-14",
    memory: "Our first Detroit-style pizza!",
    asset: "detroit",
    visual: { color: "#ed9b73" },
    suggestions: ["chicago"],
  },
  {
    id: "lighthouse",
    category: "Landmarks",
    displayName: "A light by the lake",
    location: "Sample lakeside, Michigan",
    status: "collected",
    visitDate: "2026-06-16",
    memory: "We stayed until the sky turned peach.",
    asset: "lighthouse",
    visual: { color: "#d97b66" },
    suggestions: ["museum"],
  },
  {
    id: "cherry",
    category: "Nature",
    displayName: "Cherry blossom afternoon",
    location: "Sample spring garden",
    status: "collected",
    visitDate: "2026-04-19",
    memory: "A whole afternoon under pink skies.",
    asset: "cherry",
    visual: { color: "#ecb7c3" },
    suggestions: ["mountain"],
  },
  {
    id: "cafe",
    category: "Cultural experiences",
    displayName: "The slow morning café",
    location: "Sample neighborhood café",
    status: "collected",
    visitDate: "2026-05-02",
    memory: "One more coffee. Nowhere to hurry.",
    asset: "cafe",
    visual: { color: "#83ada2" },
    suggestions: ["museum"],
  },
  {
    id: "chicago",
    category: "Regional foods",
    displayName: "Chicago deep-dish pizza",
    location: "Chicago, Illinois · demo",
    venue: "Selected sample destination",
    status: "available",
    memory: "A new chapter in our great pizza debate.",
    asset: "chicago",
    visual: { color: "#df8874" },
    suggestions: ["new-york"],
  },
  {
    id: "new-york",
    category: "Regional foods",
    displayName: "New York-style pizza",
    location: "New York, New York · sample",
    status: "available",
    asset: "new-york",
    visual: { color: "#d4b36a" },
    suggestions: [],
  },
  {
    id: "mountain",
    category: "Nature",
    displayName: "A night under the pines",
    location: "Sample mountain campsite",
    status: "available",
    asset: "mountain",
    visual: { color: "#88a27c" },
    suggestions: [],
  },
  {
    id: "museum",
    category: "Cultural experiences",
    displayName: "A little art adventure",
    location: "Sample art museum",
    status: "available",
    asset: "museum",
    visual: { color: "#bd9fc6" },
    suggestions: [],
  },
];
export interface WorldState {
  version: 1;
  collected: Record<string, { visitDate: string; memory?: string }>;
}
export const initialState = (): WorldState => ({
  version: 1,
  collected: Object.fromEntries(
    catalog
      .filter((x) => x.status === "collected")
      .map((x) => [x.id, { visitDate: x.visitDate!, memory: x.memory }]),
  ),
});
export const STORAGE_KEY = "little-world:v1";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadWorld(storage: StorageLike): WorldState {
  return readWorld(storage).state;
}
export type SaveStatus =
  "ready" | "empty" | "unavailable" | "corrupt" | "unsupported";
export function isVisitDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
  );
}
export function readWorld(storage: StorageLike): {
  state: WorldState;
  status: SaveStatus;
} {
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: initialState(), status: "unavailable" };
  }
  if (text === null) return { state: initialState(), status: "empty" };
  try {
    const raw: unknown = JSON.parse(text);
    if (
      raw &&
      typeof raw === "object" &&
      "version" in raw &&
      typeof raw.version === "number" &&
      raw.version > 1
    )
      return { state: initialState(), status: "unsupported" };
    if (
      !raw ||
      typeof raw !== "object" ||
      !("version" in raw) ||
      raw.version !== 1 ||
      !("collected" in raw) ||
      !raw.collected ||
      typeof raw.collected !== "object" ||
      Array.isArray(raw.collected)
    )
      return { state: initialState(), status: "corrupt" };
    const base = initialState();
    for (const [id, value] of Object.entries(raw.collected)) {
      if (
        id === "chicago" &&
        value &&
        typeof value === "object" &&
        isVisitDate(value.visitDate)
      )
        base.collected[id] = {
          visitDate: value.visitDate,
          memory:
            typeof value.memory === "string"
              ? value.memory.slice(0, 500)
              : undefined,
        };
    }
    // Keep a damaged save intact for deliberate recovery instead of replacing it on load.
    const invalidChicago =
      Object.hasOwn(raw.collected, "chicago") && !base.collected.chicago;
    return { state: base, status: invalidChicago ? "corrupt" : "ready" };
  } catch {
    return { state: initialState(), status: "corrupt" };
  }
}
export function collect(
  state: WorldState,
  id: string,
  date: string,
  memory?: string,
): WorldState {
  if (state.collected[id] || id !== "chicago" || !isVisitDate(date))
    return state;
  return {
    ...state,
    collected: {
      ...state.collected,
      [id]: { visitDate: date, memory: memory?.slice(0, 500) },
    },
  };
}
export function saveWorld(storage: StorageLike, state: WorldState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function recommend(
  id: string,
  state: WorldState,
): Experience | undefined {
  return catalog
    .find((x) => x.id === id)
    ?.suggestions.map((next) => catalog.find((x) => x.id === next))
    .find((x) => x && !state.collected[x.id]);
}
export type Safety = {
  state: "parked" | "driving" | "unknown";
  preview: boolean;
};
export const canInteract = (s: Safety) =>
  s.state === "parked" || (s.state === "unknown" && s.preview);
export interface Destination {
  id: "nearby" | "weekend" | "chicago";
  kind: string;
  name: string;
  location: string;
  distance: string;
  description: string;
}
export const destinations: Destination[] = [
  {
    id: "nearby",
    kind: "Nearby option",
    name: "The Neighborhood Pie",
    location: "Sample destination · Detroit area",
    distance: "8 mi",
    description: "A little deep-dish discovery, close to home.",
  },
  {
    id: "weekend",
    kind: "Weekend-drive option",
    name: "Lakeside Deep Dish",
    location: "Sample destination · West Michigan",
    distance: "165 mi",
    description: "Make a day of it. Take the scenic way.",
  },
  {
    id: "chicago",
    kind: "Iconic Chicago destination",
    name: "The Chicago Original",
    location: "Sample destination · Chicago, Illinois",
    distance: "282 mi",
    description: "A big-city chapter for your little world.",
  },
];
