import type { AssetType } from "./domain";
import { KeepsakeIcon } from "./KeepsakeIcon";
const artwork: Partial<Record<AssetType, string>> = {
  mangwon: "market",
  gyeongbokgung: "palace",
  bukhansan: "mountain",
  "seoul-museum": "museum",
};
export function KeepsakeArt({ asset }: { asset: AssetType }) {
  const art = artwork[asset];
  return art ? (
    <img
      className="keepsake-art"
      src={`./keepsakes/${art}.webp`}
      alt=""
      draggable={false}
    />
  ) : (
    <span className="keepsake-art original-keepsake">
      <KeepsakeIcon asset={asset} />
    </span>
  );
}
