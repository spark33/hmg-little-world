export type WorldAssetId =
  | "detroit"
  | "lighthouse"
  | "cherry"
  | "cafe"
  | "chicago"
  | "new-york"
  | "mountain"
  | "museum";
export type CollectibleAssetId = "chicago" | "new-york" | "mountain" | "museum";
export type WorldPosition = [number, number, number];

// A fixed island has eight reserved keepsake sites. Confirming a memory fills
// its existing site; neither time nor collection count expands the terrain.
export const WORLD_LAYOUT: Record<
  WorldAssetId,
  {
    position: WorldPosition;
    footprint: [number, number];
    label: string;
  }
> = {
  detroit: {
    position: [-2, 0.06, 0.7],
    footprint: [2.9, 2.5],
    label: "Detroit pizza shop",
  },
  lighthouse: {
    position: [-4.2, 0.06, -3.3],
    footprint: [1.9, 1.9],
    label: "Lakeside lighthouse",
  },
  cherry: {
    position: [0.25, 0.06, 1.35],
    footprint: [1.9, 1.9],
    label: "Cherry blossom garden",
  },
  cafe: {
    position: [1.1, 0.06, -2.7],
    footprint: [2.6, 2.2],
    label: "Slow morning café",
  },
  chicago: {
    position: [3.55, 0.06, 0.45],
    footprint: [2.7, 3.7],
    label: "Deep dish club",
  },
  "new-york": {
    position: [-2.1, 0.06, 4.75],
    footprint: [2.2, 1.8],
    label: "New York slice shop",
  },
  mountain: {
    position: [-0.75, 0.06, -5.25],
    footprint: [3.0, 2.4],
    label: "Pine mountain campsite",
  },
  museum: {
    position: [4.65, 0.06, -3.55],
    footprint: [2.6, 2.3],
    label: "Little art museum",
  },
};
export const COLLECTIBLE_ASSET_IDS: readonly CollectibleAssetId[] = [
  "chicago",
  "new-york",
  "mountain",
  "museum",
];
export const SEEDED_ASSET_IDS: readonly WorldAssetId[] = [
  "detroit",
  "lighthouse",
  "cherry",
  "cafe",
];

export function assetForSelection(
  selection: string | null,
): WorldAssetId | undefined {
  const id =
    selection === "plot" ? "chicago" : selection?.replace(/^plot:/, "");
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
      : [...SEEDED_ASSET_IDS, ...(props.collected ? ["chicago" as const] : [])],
  );
  const pending =
    props.collectingId === undefined && props.collecting
      ? "chicago"
      : props.collectingId;
  const collectingId =
    props.collecting &&
    COLLECTIBLE_ASSET_IDS.includes(pending as CollectibleAssetId)
      ? (pending as CollectibleAssetId)
      : null;
  return { collected, collectingId };
}
