import { describe, expect, it } from "vitest";
import { DOC_PAGES, docHtml } from "../src/docs";

describe("docs rendering", () => {
  it("keeps docs available as generated html in the app bundle", () => {
    expect(DOC_PAGES.map((page) => page.id)).toEqual(["flashing", "midi", "findings", "acknowledgements"]);
    expect(DOC_PAGES.every((page) => page.html.includes("<h1"))).toBe(true);
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
  const page = DOC_PAGES.find((entry) => entry.id === name);
  if (!page) throw new Error(`Missing generated doc ${name}`);
  return docHtml(page);
}
