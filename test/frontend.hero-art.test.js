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

  it("statically constrains the stationary art and preserves both builders on mobile", () => {
    const rule = css.match(/\.hero-art\s*\{([^}]+)\}/)[1];
    for (const declaration of ["display:block", "width:100%", "max-width:100%", "height:auto", "aspect-ratio:3 / 2", "object-fit:contain"]) {
      expect(rule).toContain(declaration);
    }
    expect(rule).not.toMatch(/animation|transition|position:absolute/);
    expect(css).toContain(".hero-visual { min-width:0; }");
    expect(css).toMatch(/@media \(max-width:760px\)\s*\{\s*\.hero-grid,\.two-column \{ grid-template-columns:1fr;/);
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("separates decorative arena layers from essential HTML and adds no runtime script", () => {
    const window = new Window();
    window.document.write(html);
    const document = window.document;
    const stage = document.querySelector('.builder-stage');
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    expect(stage.querySelectorAll('.arena-lane')).toHaveLength(2);
    expect(stage.querySelectorAll('.arena-bracket')).toHaveLength(2);
    expect(stage.querySelectorAll('a,button,input')).toHaveLength(0);
    expect(document.querySelectorAll('script')).toHaveLength(1);
    stage.remove();
    expect(document.querySelector('.hero-note').textContent).toContain('1 eligible merged PR');
    expect(document.querySelector('#month-picker')).not.toBeNull();
    expect(document.querySelector('#participation-form')).not.toBeNull();
    window.happyDOM.abort();
  });

  it("uses a small original passive SVG in only two background areas", () => {
    const svg = readFileSync(new URL('../src/frontend/arena-flows.svg', import.meta.url), 'utf8');
    expect(Buffer.byteLength(svg)).toBeLessThan(2500);
    expect(svg).toContain('viewBox="0 0 1440 760"');
    expect(svg).not.toMatch(/<script|<image|<foreignObject|<animate|href=|<text/);
    expect(css.match(/url\('\/arena-flows.svg'\)/g)).toHaveLength(2);
    expect(css).toContain('height:7rem');
    expect(css).toContain('mask-image:linear-gradient(#000,transparent)');
  });

  it("limits motion to finite entrances and interactions with a fully static reduced-motion mode", () => {
    expect(css).toContain('@media (prefers-reduced-motion:no-preference)');
    expect(css).toContain('animation:lane-cyan-entry 900ms ease-out both');
    expect(css).toContain('animation:lane-violet-entry 1100ms ease-out both');
    expect(css).toContain('animation:none!important; transition:none!important;');
    expect(css).not.toMatch(/infinite|animation:.*hero-art/);
    const keyframes = css.slice(css.indexOf('@keyframes arena-entry'), css.indexOf('@media (max-width:760px)', css.indexOf('@keyframes arena-entry')));
    expect(keyframes).not.toMatch(/\b(width|height|top|left|margin|padding):/);
    expect(css).toContain('.builder-stage { margin-inline:0; }');
  });
});
