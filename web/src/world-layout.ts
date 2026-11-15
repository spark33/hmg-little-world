export type WorldAssetId =
  | "gwangjang"
  | "namsan"
  | "seokchon"
  | "seongsu"
  | "mangwon"
  | "gyeongbokgung"
  | "bukhansan"
  | "seoul-museum";
export type CollectibleAssetId =
  "mangwon" | "gyeongbokgung" | "bukhansan" | "seoul-museum";
export type WorldPosition = [number, number, number];

// A fixed island has eight reserved keepsake sites. Confirming a memory fills
// its existing site; neither time nor collection count expands the terrain.
// These are Seoul-inspired illustrations, not maps or venue coordinates.
export const WORLD_LAYOUT: Record<
  WorldAssetId,
  {
    position: WorldPosition;
    footprint: [number, number];
    label: string;
  }
> = {
  gwangjang: {
    position: [-2, 0.06, 0.7],
    footprint: [2.9, 2.5],
    label: "Gwangjang market stall",
  },
  namsan: {
    position: [-4.2, 0.06, -3.3],
    footprint: [1.9, 1.9],
    label: "Namsan tower",
  },
  seokchon: {
    position: [0.25, 0.06, 1.35],
    footprint: [1.9, 1.9],
    label: "Seokchon blossom garden",
  },
  seongsu: {
    position: [1.1, 0.06, -2.7],
    footprint: [2.6, 2.2],
    label: "Seongsu café",
  },
  mangwon: {
    position: [3.55, 0.06, 0.45],
    footprint: [2.7, 3.7],
    label: "Mangwon market picnic",
  },
  gyeongbokgung: {
    position: [-2.1, 0.06, 4.75],
    footprint: [2.3, 1.8],
    label: "Gyeongbokgung hanok pavilion",
  },
  bukhansan: {
    position: [-0.75, 0.06, -5.25],
    footprint: [3.0, 2.4],
    label: "Bukhansan hiking keepsake",
  },
  "seoul-museum": {
    position: [4.65, 0.06, -3.55],
    footprint: [2.6, 2.3],
    label: "Seoul art museum",
  },
};
export const COLLECTIBLE_ASSET_IDS: readonly CollectibleAssetId[] = [
  "mangwon",
  "gyeongbokgung",
  "bukhansan",
  "seoul-museum",
];
export const SEEDED_ASSET_IDS: readonly WorldAssetId[] = [
  "gwangjang",
  "namsan",
  "seokchon",
  "seongsu",
];

export function assetForSelection(
  selection: string | null,
): WorldAssetId | undefined {
  const id =
    selection === "plot" ? "mangwon" : selection?.replace(/^plot:/, "");
  return id && Object.hasOwn(WORLD_LAYOUT, id)
    ? (id as WorldAssetId)
    : undefined;
}

export function worldProgress(props: {
  collected?: boolean;
  collecting?: boolean;
  collectedIds?: readonly string[];
  collectingId?: string | null;
}) {
  const collected = new Set<WorldAssetId>(
    props.collectedIds
      ? props.collectedIds.filter((id): id is WorldAssetId =>
          Object.hasOwn(WORLD_LAYOUT, id),
        )
      : [...SEEDED_ASSET_IDS, ...(props.collected ? ["mangwon" as const] : [])],
  );
  const pending =
    props.collectingId === undefined && props.collecting
      ? "mangwon"
      : props.collectingId;
  const collectingId =
    props.collecting &&
    COLLECTIBLE_ASSET_IDS.includes(pending as CollectibleAssetId)
      ? (pending as CollectibleAssetId)
      : null;
  return { collected, collectingId };
}
