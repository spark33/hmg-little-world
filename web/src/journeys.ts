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
      return "A curated pairing: Gwangjang’s market-food illustration leads to a picnic chapter at Mangwon. This is inspiration for a demo outing, not a recommendation based on a verified visit.";
    case "namsan":
      return "A curated pairing of Seoul landmarks: from the tower illustration to a palace walk.";
    case "seokchon":
      return "A curated pairing of outdoor chapters: from lakeside blossoms to a mountain morning.";
    case "seongsu":
      return "A curated pairing of creative Seoul: from a café illustration to an art museum afternoon.";
    default:
      return "A curated next chapter from the Seoul demo collection, offered as inspiration for another outing.";
  }
}
