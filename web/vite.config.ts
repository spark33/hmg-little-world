import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "bundled-dependency-inventory",
      apply: "build",
      generateBundle(_options, bundle) {
        const packages = new Map<
          string,
          { path: string; name: string; version: string }
        >();
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          for (const [id, module] of Object.entries(output.modules)) {
            if (!module.renderedLength) continue;
            const marker = "/node_modules/";
            const normalized = id.replaceAll("\0", "").replaceAll("\\", "/");
            const index = normalized.lastIndexOf(marker);
            if (index === -1) continue;
            const segments = normalized.slice(index + marker.length).split("/");
            const name = segments
              .slice(0, segments[0].startsWith("@") ? 2 : 1)
              .join("/");
            const directory = normalized.slice(0, index + marker.length) + name;
            const metadata = JSON.parse(
              readFileSync(`${directory}/package.json`, "utf8"),
            );
            if (
              typeof metadata.name !== "string" ||
              typeof metadata.version !== "string"
            )
              throw new Error(
                "A bundled dependency is missing package identity",
              );
            const path = directory.slice(
              directory.indexOf("/node_modules/") + 1,
            );
            packages.set(path, {
              path,
              name: metadata.name,
              version: metadata.version,
            });
          }
        }
        this.emitFile({
          type: "asset",
          fileName: "bundle-dependencies.json",
          source:
            JSON.stringify(
              {
                schemaVersion: 1,
                lockfileSha256: createHash("sha256")
                  .update(
                    readFileSync(
                      new URL("./package-lock.json", import.meta.url),
                    ),
                  )
                  .digest("hex"),
                scope: "rendered-production-javascript",
                packages: [...packages.values()].sort(
                  (a, b) =>
                    a.name.localeCompare(b.name) ||
                    a.version.localeCompare(b.version),
                ),
              },
              null,
              2,
            ) + "\n",
        });
      },
    },
    {
      name: "local-content-policy",
      apply: "build",
      transformIndexHtml() {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-src 'none'",
            },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  ],
  base: "./",
  build: { chunkSizeWarningLimit: 1200 },
});
