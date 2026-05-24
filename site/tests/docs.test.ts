import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DOC_PAGES } from "../src/docs";

describe("docs rendering", () => {
  it("keeps public docs backed by generated html and markdown files", () => {
    expect(DOC_PAGES.map((page) => page.path)).toEqual([
      "./docs/flashing.html",
      "./docs/midi.html",
      "./docs/findings.html",
      "./docs/acknowledgements.html",
    ]);
    expect(DOC_PAGES.map((page) => page.sourcePath)).toEqual([
      "./docs/flashing.md",
      "./docs/midi.md",
      "./docs/findings.md",
      "./docs/acknowledgements.md",
    ]);
  });

  it("renders wrapped firmware list items at build time", () => {
    const html = generatedDoc("findings");
    expect(html.replace(/\s+/g, " ")).toContain(
      "<li><code>rt02r-recovery.bin</code>: RT02R recovery image for rings that still connect over BLE.</li>",
    );
  });

  it("renders external links safely at build time", () => {
    const html = generatedDoc("acknowledgements");
    expect(html).toContain('href="https://github.com/atc1441/ATC_RF03_Ring"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it("keeps long firmware strings inside code elements", () => {
    const html = generatedDoc("findings");
    expect(html).toContain("<code>RT02CR_3.12.07_260514</code>");
  });
});

function generatedDoc(name: string): string {
  return readFileSync(new URL(`../public/docs/${name}.html`, import.meta.url), "utf8");
}
