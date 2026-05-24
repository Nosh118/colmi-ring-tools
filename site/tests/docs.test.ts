import { describe, expect, it } from "vitest";
import { DOC_PAGES, markdownToHtml } from "../src/docs";

describe("docs rendering", () => {
  it("keeps public docs backed by markdown files", () => {
    expect(DOC_PAGES.map((page) => page.path)).toEqual([
      "./docs/flashing.md",
      "./docs/midi.md",
      "./docs/findings.md",
      "./docs/acknowledgements.md",
    ]);
  });

  it("renders basic markdown safely", () => {
    expect(markdownToHtml("# Title\n\n- Use `code`\n- Escape <tags>")).toBe(
      "<h1>Title</h1><ul><li>Use <code>code</code></li><li>Escape &lt;tags&gt;</li></ul>",
    );
  });

  it("renders https links safely", () => {
    expect(markdownToHtml("[Docs](https://example.com/ref)")).toBe(
      '<p><a href="https://example.com/ref" target="_blank" rel="noopener noreferrer">Docs</a></p>',
    );
  });
});
