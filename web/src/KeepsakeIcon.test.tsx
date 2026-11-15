import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KeepsakeIcon } from "./KeepsakeIcon";

describe("keepsake vector accessibility", () => {
  it("keeps decorative keepsakes out of the accessibility tree", () => {
    const markup = renderToStaticMarkup(<KeepsakeIcon asset="gwangjang" />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain("<title");
  });
  it("links an explicitly named icon to its own escaped title", () => {
    const markup = renderToStaticMarkup(
      <div>
        <KeepsakeIcon asset="gyeongbokgung" title="Palace & garden" />
        <KeepsakeIcon asset="bukhansan" title="Mountain trail" />
      </div>,
    );
    const labels = [...markup.matchAll(/aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const titles = [
      ...markup.matchAll(/<title id="([^"]+)">([^<]+)<\/title>/g),
    ];
    expect(new Set(labels).size).toBe(2);
    expect(titles.map((match) => match[1])).toEqual(labels);
    expect(titles.map((match) => match[2])).toEqual([
      "Palace &amp; garden",
      "Mountain trail",
    ]);
  });
});
