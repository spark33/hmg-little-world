import { catalog, type Experience, type WorldState } from "./domain";

/** Source groups are explicit: a demo confirmation is never a verified visit. */
export function collectionGroups(world: WorldState) {
  const confirmed: Experience[] = [];
  const illustrations: Experience[] = [];
  for (const item of catalog) {
    const record = world.collected[item.id];
    if (!record) continue;
    (record.provenance === "confirmed-demo" ? confirmed : illustrations).push(
      item,
    );
  }
  confirmed.sort(
    (a, b) =>
      world.collected[b.id].visitDate.localeCompare(
        world.collected[a.id].visitDate,
      ) || a.id.localeCompare(b.id),
  );
  return { confirmed, illustrations };
}

export function curatedReason(sourceId: string): string {
  switch (sourceId) {
    case "gwangjang":
      return "A market-food chapter with room for a picnic. Curated outing inspiration.";
    case "namsan":
      return "From skyline views to palace courtyards. A curated next chapter.";
    case "seokchon":
      return "From lakeside blossoms to a mountain morning.";
    case "seongsu":
      return "From a café morning to an afternoon of art.";
    default:
      return "Another chapter for your collection. An idea for your next outing.";
  }
}
