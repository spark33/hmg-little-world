import { useId } from "react";
import type { AssetType } from "./domain";

type IconAsset =
  | AssetType
  | "gwangjang"
  | "seongsu"
  | "seokchon"
  | "namsan"
  | "mangwon"
  | "gyeongbokgung"
  | "bukhansan"
  | "seoul-museum";

/** Original vector keepsakes keep their appearance across browser/WebView fonts. */
export function KeepsakeIcon({
  asset,
  title,
  className = "",
}: {
  asset: IconAsset;
  title?: string;
  className?: string;
}) {
  const titleId = useId();
  return (
    <svg
      className={`keepsake-icon ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title id={titleId}>{title}</title>}
      <rect x="2" y="2" width="60" height="60" rx="18" fill="#ede7ce" />
      {(asset === "gwangjang" || asset === "mangwon") && (
        <>
          <path d="M15 27v24m34-24v24" stroke="#8b7357" strokeWidth="4" />
          <path d="m10 27 7-14h30l7 14z" fill="#ead3a0" />
          <path
            d="m17 13-4 14h7l2-14m8 0-1 14h7l-1-14m8 0 2 14h7l-5-14"
            fill={asset === "mangwon" ? "#789888" : "#bb725b"}
          />
          <path d="M10 27h44v4H10z" fill="#fff3d5" />
          <path d="M12 39h40v13H12z" fill="#b58c66" />
          <path d="M10 38h44v5H10z" fill="#e3bf88" />
          {asset === "gwangjang" ? (
            <>
              <ellipse cx="24" cy="36" rx="9" ry="3" fill="#f5e7c0" />
              <path d="m18 34 2-5 3 5m2 0 2-5 3 5" fill="#d4ab70" />
              <circle cx="43" cy="34" r="5" fill="#788e61" />
              <circle cx="38" cy="36" r="4" fill="#c77b54" />
            </>
          ) : (
            <>
              <path
                d="M23 34c0-12 18-12 18 0"
                stroke="#8b7357"
                strokeWidth="3"
              />
              <path d="m20 34 3 13h19l3-13z" fill="#e4bd7e" />
              <path d="M22 38h21m-19 5h17" stroke="#b58c66" strokeWidth="2" />
              <path d="m29 33 1-7 5 7m2 0 3-6 2 7" fill="#839c69" />
            </>
          )}
        </>
      )}
      {asset === "namsan" && (
        <>
          <path d="m8 52 12-17 9 8 10-13 17 22z" fill="#90a77a" />
          <path d="M29 22h6v31h-6z" fill="#fff6dc" />
          <path d="M31 7h2v12h-2z" fill="#687c79" />
          <ellipse cx="32" cy="22" rx="10" ry="5" fill="#b6a5a0" />
          <path d="M22 19h20v5H22z" fill="#8f9f9b" />
          <path d="M25 18h14v4H25z" fill="#e2b1a3" />
          <path d="M26 25h12l-3 5h-6z" fill="#cfbbb0" />
        </>
      )}
      {asset === "gyeongbokgung" && (
        <>
          <path d="M10 48h44v6H10z" fill="#b8b29a" />
          <path d="M16 28h32v20H16z" fill="#c28267" />
          <path d="M21 32h5v16h-5zm17 0h5v16h-5z" fill="#f2dfb4" />
          <path d="M29 34h6v14h-6z" fill="#5d7b6d" />
          <path d="m8 28 10-7h28l10 7-3 3H11z" fill="#637e72" />
          <path d="m17 21 8-7h14l8 7-3 3H20z" fill="#7d9782" />
          <path
            d="M9 27c9 5 37 5 46 0M18 20c7 4 22 4 28 0"
            stroke="#435f58"
            strokeWidth="3"
          />
        </>
      )}
      {asset === "seoul-museum" && (
        <>
          <path d="M8 25h48v7H8z" fill="#b1a58a" />
          <path d="M12 32h14v19H12zm26 0h14v19H38z" fill="#d6cdb3" />
          <path d="M26 32h12v19H26z" fill="#8ba5a0" />
          <path d="M18 33h3v14h-3zm25 0h3v14h-3z" fill="#a99d82" />
          <path d="M8 51h48v4H8z" fill="#8a947e" />
          <path d="M13 20h38v5H13z" fill="#e1d8bf" />
          <path d="M32 34v16" stroke="#f7efda" strokeWidth="2" />
        </>
      )}
      {asset === "detroit" && (
        <>
          <rect x="11" y="16" width="42" height="34" rx="5" fill="#617e75" />
          <rect x="15" y="19" width="34" height="27" rx="3" fill="#c98f52" />
          <path d="M18 22h28v21H18z" fill="#ecc874" />
          <path d="M32 22v21M18 32h28" stroke="#ad7446" strokeWidth="2" />
          <path
            d="M23 26h3v3h-3zM37 25h4v4h-4zM23 36h4v4h-4zM38 36h3v4h-3z"
            fill="#aa5746"
          />
        </>
      )}
      {asset === "chicago" && (
        <>
          <ellipse cx="32" cy="40" rx="23" ry="13" fill="#657e7d" />
          <path d="M12 30v9c0 15 40 15 40 0v-9" fill="#ba8055" />
          <ellipse cx="32" cy="30" rx="20" ry="12" fill="#efce80" />
          <ellipse cx="32" cy="30" rx="15" ry="8" fill="#b7604c" />
          <path
            d="m23 28 4-2 1 3-4 2m12-4 4 1-2 3-3-1m-5 5 4-1 1 3-4 1"
            fill="#edd087"
          />
        </>
      )}
      {asset === "new-york" && (
        <>
          <path d="m14 17 38 8-25 29z" fill="#c88f56" />
          <path d="m18 21 28 6-19 22z" fill="#edcc7c" />
          <path d="m14 17 38 8" stroke="#ad7045" strokeWidth="6" />
          <circle cx="27" cy="28" r="3" fill="#b7604c" />
          <circle cx="35" cy="31" r="3" fill="#b7604c" />
          <circle cx="27" cy="39" r="3" fill="#b7604c" />
        </>
      )}
      {asset === "lighthouse" && (
        <>
          <path
            d="M8 49c7-5 11 5 18 0s12 5 20 0 10 0 10 0"
            stroke="#7ca6a5"
            strokeWidth="4"
          />
          <path d="m24 23-5 24h26l-5-24z" fill="#fff8e5" />
          <path d="m23 29-1 7h21l-1-7z" fill="#bb715d" />
          <path
            d="M23 15h18v9H23z"
            fill="#9fbcb4"
            stroke="#59766e"
            strokeWidth="2"
          />
          <path d="m20 15 12-8 12 8z" fill="#bc775c" />
          <path d="M29 40h6v7h-6z" fill="#59766e" />
        </>
      )}
      {(asset === "cherry" || asset === "seokchon") && (
        <>
          {asset === "seokchon" && (
            <ellipse cx="32" cy="49" rx="25" ry="8" fill="#a8c9c1" />
          )}
          <path
            d="M32 52V27m0 14-12-9m12 4 12-12"
            stroke="#98704f"
            strokeWidth="5"
          />
          <circle cx="19" cy="25" r="11" fill="#d8a0b0" />
          <circle cx="31" cy="18" r="12" fill="#e6b5c2" />
          <circle cx="44" cy="26" r="12" fill="#dca5b8" />
          <circle cx="31" cy="31" r="12" fill="#edc6ce" />
          <path d="m17 45 3 2m24-3 3 2" stroke="#c78c9f" strokeWidth="3" />
        </>
      )}
      {(asset === "cafe" || asset === "seongsu") && (
        <>
          <ellipse cx="31" cy="49" rx="23" ry="5" fill="#b7c8af" />
          <path
            d="M44 27h4c12 0 10 16-2 16h-4"
            stroke="#7c9b8e"
            strokeWidth="5"
          />
          <path d="M15 25h29v14c0 14-29 14-29 0z" fill="#fff6da" />
          <ellipse cx="29.5" cy="25" rx="14.5" ry="5" fill="#b79565" />
          <ellipse cx="29.5" cy="25" rx="11" ry="3" fill="#755843" />
          <path
            d="M23 16c-5-5 4-5 0-10m11 10c-5-5 4-5 0-10"
            stroke="#b6bda0"
            strokeWidth="2"
          />
        </>
      )}
      {(asset === "mountain" || asset === "bukhansan") && (
        <>
          {asset === "mountain" && (
            <circle cx="45" cy="15" r="6" fill="#e7c67d" />
          )}
          <path d="m7 49 20-32 21 32z" fill="#89a18a" />
          <path d="m20 28 7-11 8 12-8-4z" fill="#f7f1da" />
          <path d="m32 49 12-19 13 19z" fill="#668473" />
          {asset === "mountain" ? (
            <>
              <path d="m15 51 9-13 10 13z" fill="#c98e60" />
              <path d="m24 38 5 13H19z" fill="#f0d49d" />
            </>
          ) : (
            <>
              <path d="m32 49-4-7 5-7-2-6" stroke="#e3d3a3" strokeWidth="3" />
              <path d="m47 39 6-10 6 10z" fill="#5b7c66" />
              <path d="M53 39v10" stroke="#8b7357" strokeWidth="3" />
            </>
          )}
        </>
      )}
      {asset === "museum" && (
        <>
          <path d="m9 25 23-14 23 14z" fill="#ac8ea9" />
          <path d="M13 28h38v21H13z" fill="#f6eed7" />
          <path
            d="M18 29v18m14-18v18m14-18v18"
            stroke="#baa5b8"
            strokeWidth="6"
          />
          <path
            d="M10 26h44M10 50h44M7 54h50"
            stroke="#8c748c"
            strokeWidth="4"
          />
          <circle cx="32" cy="21" r="3" fill="#f6eed7" />
        </>
      )}
    </svg>
  );
}
