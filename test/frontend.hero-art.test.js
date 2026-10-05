import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";

const html = readFileSync(new URL("../src/frontend/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/frontend/styles.css", import.meta.url), "utf8");

describe("competition hero illustration", () => {
  it("ships one small local WebP with dimensions matching the reserved HTML box", () => {
    const window = new Window();
    window.document.write(html);
    const images = window.document.querySelectorAll(".hero img");
    expect(images).toHaveLength(1);
    const image = images[0];
    expect(image.getAttribute("src")).toBe("/competition-builders.webp");
    expect(image.getAttribute("width")).toBe("1200");
    expect(image.getAttribute("height")).toBe("800");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("fetchpriority")).toBe("high");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    const asset = readFileSync(new URL(`../src/frontend${image.getAttribute("src")}`, import.meta.url));
    expect(asset.length).toBeLessThan(100_000);
    expect(asset.toString("ascii", 0, 4)).toBe("RIFF");
    expect(asset.toString("ascii", 8, 16)).toBe("WEBPVP8 ");
    expect(asset.readUInt16LE(26) & 0x3fff).toBe(1200);
    expect(asset.readUInt16LE(28) & 0x3fff).toBe(800);
    window.happyDOM.abort();
  });

  it("keeps meaningful content and navigation in HTML when the decorative asset is unavailable", () => {
    const window = new Window();
    window.document.write(html);
    const document = window.document;
    document.querySelector(".hero-art").remove();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("#page-title").textContent).toBe("Vibe Coding Rivals");
    expect(document.querySelector(".hero-copy").textContent).toContain("Compete with builders using AI");
    expect(document.querySelector(".hero .button-primary").getAttribute("href")).toBe("#participate");
    expect(document.querySelector(".hero-ranking-link").getAttribute("href")).toBe("#leaderboard");
    expect(document.querySelector(".hero-note").textContent).toContain("not code quality or developer productivity");
    expect(document.querySelector("#participation-form")).not.toBeNull();
    window.happyDOM.abort();
  });

  it("statically constrains the art to its column and preserves the full mobile composition without motion", () => {
    const rule = css.match(/\.hero-art\s*\{([^}]+)\}/)[1];
    for (const declaration of ["display:block", "width:100%", "max-width:100%", "height:auto", "aspect-ratio:3 / 2", "object-fit:contain"]) {
      expect(rule).toContain(declaration);
    }
    expect(rule).not.toMatch(/animation|transition|position:absolute/);
    expect(css).toContain(".hero-visual { min-width:0; }");
    expect(css).toMatch(/@media \(max-width:760px\)\s*\{\s*\.hero-grid,\.two-column \{ grid-template-columns:1fr;/);
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
