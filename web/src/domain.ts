import {
  isVisitDate,
  isDemoDestinationId,
  readWorld as readStoredWorld,
  saveWorld as saveStoredWorld,
  type MemoryRecord,
  type DemoDestinationId,
  type PersistenceConfig,
  type StorageLike,
  type WorldState,
} from "./persistence";
export { STORAGE_KEY, isVisitDate } from "./persistence";
export type {
  DemoDestinationId,
  MemoryRecord,
  SaveStatus,
  StorageLike,
  WorldState,
} from "./persistence";

export type AssetType =
  | "gwangjang"
  | "seongsu"
  | "seokchon"
  | "namsan"
  | "mangwon"
  | "gyeongbokgung"
  | "bukhansan"
  | "seoul-museum"
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
export const legacyCatalog: Experience[] = [
  {
    id: "detroit",
    category: "Regional foods",
    displayName: "Detroit-style pizza",
    location: "Detroit, Michigan",
    venue: "Detroit pizza inspiration",
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
    location: "Lakeside, Michigan",
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
    location: "Spring garden",
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
    location: "Neighborhood café",
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
    location: "Chicago, Illinois",
    venue: "Selected destination",
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
    location: "New York, New York",
    status: "available",
    asset: "new-york",
    visual: { color: "#d4b36a" },
    suggestions: [],
  },
  {
    id: "mountain",
    category: "Nature",
    displayName: "A night under the pines",
    location: "Mountain campsite",
    status: "available",
    asset: "mountain",
    visual: { color: "#88a27c" },
    suggestions: [],
  },
  {
    id: "museum",
    category: "Cultural experiences",
    displayName: "A little art adventure",
    location: "Art museum",
    status: "available",
    asset: "museum",
    visual: { color: "#bd9fc6" },
    suggestions: [],
  },
];
/** Current Seoul chapters. Names describe illustrative experiences, not verified visits. */
export const catalog: Experience[] = [
  {
    id: "gwangjang",
    category: "Regional foods",
    displayName: "Gwangjang Market flavors",
    location: "Jongno, Seoul",
    venue: "Gwangjang Market inspiration",
    status: "collected",
    visitDate: "2026-06-14",
    memory: "A market afternoon full of little discoveries.",
    asset: "gwangjang",
    visual: { color: "#d89160" },
    suggestions: ["mangwon"],
  },
  {
    id: "namsan",
    category: "Landmarks",
    displayName: "Namsan evening lights",
    location: "Namsan, Seoul",
    status: "collected",
    visitDate: "2026-06-16",
    memory: "The city lights felt close enough to touch.",
    asset: "namsan",
    visual: { color: "#819ba7" },
    suggestions: ["gyeongbokgung"],
  },
  {
    id: "seokchon",
    category: "Nature",
    displayName: "Seokchon Lake blossoms",
    location: "Songpa, Seoul",
    status: "collected",
    visitDate: "2026-04-19",
    memory: "A whole afternoon under pink skies.",
    asset: "seokchon",
    visual: { color: "#ecb7c3" },
    suggestions: ["bukhansan"],
  },
  {
    id: "seongsu",
    category: "Cultural experiences",
    displayName: "Seongsu slow morning",
    location: "Seongsu, Seoul",
    status: "collected",
    visitDate: "2026-05-02",
    memory: "One more coffee. Nowhere to hurry.",
    asset: "seongsu",
    visual: { color: "#83ada2" },
    suggestions: ["seoul-museum"],
  },
  {
    id: "mangwon",
    category: "Regional foods",
    displayName: "Mangwon Market picnic",
    location: "Mapo, Seoul",
    status: "available",
    memory: "Market treats and a little room for a picnic.",
    asset: "mangwon",
    visual: { color: "#d79872" },
    suggestions: ["gyeongbokgung"],
  },
  {
    id: "gyeongbokgung",
    category: "Landmarks",
    displayName: "Gyeongbokgung palace walk",
    location: "Jongno, Seoul",
    status: "available",
    memory: "A quiet courtyard in the middle of our city day.",
    asset: "gyeongbokgung",
    visual: { color: "#7b9c8b" },
    suggestions: ["bukhansan"],
  },
  {
    id: "bukhansan",
    category: "Nature",
    displayName: "Bukhansan trail morning",
    location: "Bukhansan, Seoul",
    status: "available",
    memory: "Fresh air, tall pines, and a new view of Seoul.",
    asset: "bukhansan",
    visual: { color: "#88a27c" },
    suggestions: ["seoul-museum"],
  },
  {
    id: "seoul-museum",
    category: "Cultural experiences",
    displayName: "Seoul museum afternoon",
    location: "Seoul",
    status: "available",
    memory: "We found a new favorite way to see our city.",
    asset: "seoul-museum",
    visual: { color: "#bd9fc6" },
    suggestions: [],
  },
];
export const allExperiences = [...catalog, ...legacyCatalog];
export const illustrationIds = [...catalog, ...legacyCatalog]
  .filter((item) => item.status === "collected")
  .map((item) => item.id);

export const initialState = (): WorldState => ({
  version: 2,
  collected: Object.fromEntries(
    catalog
      .filter((x) => x.status === "collected")
      .map((x) => [
        x.id,
        {
          visitDate: x.visitDate!,
          memory: x.memory,
          provenance: "illustration" as const,
        },
      ]),
  ),
});
export const persistenceConfig: PersistenceConfig = {
  knownIds: allExperiences.map((item) => item.id),
  illustrationIds,
  initialState,
};
export function readWorld(storage: StorageLike) {
  return readStoredWorld(storage, persistenceConfig);
}
export function loadWorld(storage: StorageLike): WorldState {
  return readWorld(storage).state;
}
export function collect(
  state: WorldState,
  id: string,
  date: string,
  memory?: string,
  demoDestinationId?: DemoDestinationId,
): WorldState {
  if (
    state.collected[id] ||
    !catalog.some((x) => x.id === id && x.status === "available") ||
    !isVisitDate(date) ||
    (demoDestinationId !== undefined && !isDemoDestinationId(demoDestinationId))
  )
    return state;
  return {
    ...state,
    collected: {
      ...state.collected,
      [id]: {
        visitDate: date,
        memory: memory?.slice(0, 500),
        provenance: "confirmed-demo",
        ...(demoDestinationId === undefined ? {} : { demoDestinationId }),
      },
    },
  };
}
export function saveWorld(
  storage: StorageLike,
  state: WorldState,
  options?: { replaceProtected?: boolean },
): boolean {
  return saveStoredWorld(storage, state, persistenceConfig, options);
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
  id: DemoDestinationId;
  kind: string;
  name: string;
  location: string;
  distance: string;
  description: string;
}
export const categories = [
  "All keepsakes",
  "Regional foods",
  "Nature",
  "Landmarks",
  "Cultural experiences",
] as const;
export type CategoryFilter = (typeof categories)[number];
export const collectibleIds = catalog
  .filter((x) => x.status === "available")
  .map((x) => x.id);
export function nextExperience(state: WorldState): Experience | undefined {
  return catalog.find(
    (x) => x.status === "available" && !state.collected[x.id],
  );
}
export function updateMemory(
  state: WorldState,
  id: string,
  memory: string,
): WorldState {
  if (!allExperiences.some((x) => x.id === id) || !state.collected[id])
    return state;
  return {
    ...state,
    collected: {
      ...state.collected,
      [id]: { ...state.collected[id], memory: memory.trim().slice(0, 500) },
    },
  };
}
export const experienceDetails: Record<
  AssetType,
  {
    symbol: string;
    description: string;
    findLabel: string;
    question: string;
    memory: string;
  }
> = {
  gwangjang: {
    symbol: "▤",
    description:
      "A warm market stall and a city afternoon full of small discoveries.",
    findLabel: "Explore market flavors",
    question: "Did you enjoy Gwangjang Market flavors?",
    memory: "A market afternoon full of little discoveries.",
  },
  seongsu: {
    symbol: "☕",
    description: "A café morning, with a little space to slow down.",
    findLabel: "Explore Seongsu",
    question: "Did you enjoy a Seongsu slow morning?",
    memory: "One more coffee. Nowhere to hurry.",
  },
  seokchon: {
    symbol: "❀",
    description: "An afternoon of blossoms around a quiet city lake.",
    findLabel: "Explore Seokchon Lake",
    question: "Did you enjoy the Seokchon Lake blossoms?",
    memory: "A whole afternoon under pink skies.",
  },
  namsan: {
    symbol: "⌁",
    description: "A miniature tower keeping watch over the city lights.",
    findLabel: "Explore Namsan",
    question: "Did you enjoy the Namsan evening lights?",
    memory: "The city lights felt close enough to touch.",
  },
  mangwon: {
    symbol: "▤",
    description:
      "A market basket. A little picnic. A new Seoul gathering place for your world.",
    findLabel: "Find a Mangwon picnic",
    question: "Did you enjoy a Mangwon Market picnic?",
    memory: "Market treats and a little room for a picnic.",
  },
  gyeongbokgung: {
    symbol: "⌂",
    description:
      "A tiled roof, a quiet courtyard, and a little piece of Seoul history for your island.",
    findLabel: "Find a palace walk",
    question: "Did you enjoy a Gyeongbokgung palace walk?",
    memory: "A quiet courtyard in the middle of our city day.",
  },
  bukhansan: {
    symbol: "▲",
    description:
      "A trail under tall pines. Keep a little of Seoul’s mountain quiet, wherever you go.",
    findLabel: "Find a Bukhansan trail",
    question: "Did you enjoy a Bukhansan trail morning?",
    memory: "Fresh air, tall pines, and a new view of Seoul.",
  },
  "seoul-museum": {
    symbol: "▥",
    description:
      "A tiny Seoul museum for a big new perspective. Bring home the feeling of discovering something beautiful.",
    findLabel: "Find a Seoul art adventure",
    question: "Did you enjoy a Seoul museum afternoon?",
    memory: "We found a new favorite way to see our city.",
  },
  detroit: {
    symbol: "🍕",
    description: "Our first square slice of adventure.",
    findLabel: "Explore Detroit",
    question: "Did you try Detroit-style pizza?",
    memory: "Our first Detroit-style pizza!",
  },
  lighthouse: {
    symbol: "⚓",
    description: "A quiet light at the edge of the lake.",
    findLabel: "Explore the lakeside",
    question: "Did you visit the lighthouse?",
    memory: "We stayed until the sky turned peach.",
  },
  cherry: {
    symbol: "❀",
    description: "An afternoon beneath a pink canopy.",
    findLabel: "Explore the garden",
    question: "Did you enjoy the blossoms?",
    memory: "A whole afternoon under pink skies.",
  },
  cafe: {
    symbol: "☕",
    description: "A slow morning, with nowhere to hurry.",
    findLabel: "Explore the café",
    question: "Did you stop for a coffee?",
    memory: "One more coffee. Nowhere to hurry.",
  },
  chicago: {
    symbol: "🍕",
    description:
      "A golden crust. A wonderfully deep filling. A new little gathering place for your world.",
    findLabel: "Find deep-dish pizza",
    question: "Did you try Chicago deep-dish pizza?",
    memory: "A new chapter in our great pizza debate.",
  },
  "new-york": {
    symbol: "🍕",
    description:
      "A corner slice shop, a yellow cab, and a little big-city energy for your island.",
    findLabel: "Find a New York slice",
    question: "Did you try New York-style pizza?",
    memory: "A foldable slice and a city-sized smile.",
  },
  mountain: {
    symbol: "▲",
    description:
      "A tent under tall pines. Keep a little of the quiet, wherever you go.",
    findLabel: "Find a mountain escape",
    question: "Did you enjoy a night under the pines?",
    memory: "The stars were brighter than we remembered.",
  },
  museum: {
    symbol: "▥",
    description:
      "A tiny gallery for a big new perspective. Bring home the feeling of discovering something beautiful.",
    findLabel: "Find an art adventure",
    question: "Did you enjoy a little art adventure?",
    memory: "We found a new favorite way to see the world.",
  },
};
export const destinations: Destination[] = [
  {
    id: "nearby",
    kind: "Nearby Seoul possibility",
    name: "Mangwon picnic corner",
    location: "Mapo, Seoul",
    distance: "2 km",
    description: "Imagine a little market picnic, close to home.",
  },
  {
    id: "weekend",
    kind: "A little farther in Seoul",
    name: "Han River picnic pause",
    location: "Seoul riverside",
    distance: "6 km",
    description: "Make a little room for a slower city afternoon.",
  },
  {
    id: "chicago",
    kind: "A Seoul day out",
    name: "Mapo market afternoon",
    location: "Seoul",
    distance: "11 km",
    description: "A new chapter for your Seoul keepsake story.",
  },
];
export function destinationsFor(id: string): Destination[] {
  if (id === "mangwon") return destinations;
  const experience = catalog.find((x) => x.id === id);
  if (!experience || experience.status !== "available") return [];
  const names: Record<string, string[]> = {
    gyeongbokgung: [
      "Palace courtyard chapter",
      "Jongno culture stroll",
      "Seoul history afternoon",
    ],
    bukhansan: [
      "Pine trail pause",
      "A Seoul mountain morning",
      "A quiet summit chapter",
    ],
    "seoul-museum": [
      "A neighborhood gallery chapter",
      "A city museum afternoon",
      "A little art discovery",
    ],
  };
  return destinations.map((destination, index) => ({
    ...destination,
    name: names[id][index],
    location: "Seoul · outing inspiration",
    description: [
      "A little Seoul discovery, close to home.",
      "Leave room for a city adventure.",
      "Imagine a new chapter a little farther away.",
    ][index],
  }));
}

/** The note belongs to the device's local calendar day, not its UTC day. */
export function localVisitDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
