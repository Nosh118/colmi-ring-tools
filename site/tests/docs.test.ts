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
    const html = markdownToHtml("# Title\n\n- Use `code`\n- Escape <tags>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<li>Use <code>code</code></li>");
    expect(html).toContain("<li>Escape &lt;tags&gt;</li>");
  });

  it("keeps indented continuation lines inside list items", () => {
    const html = markdownToHtml("- Firmware starts here\n  and wraps onto another line.\n- Next item");
    expect(html.replace(/\s+/g, " ")).toContain("<li>Firmware starts here and wraps onto another line.</li>");
    expect(html).toContain("<li>Next item</li>");
  });

  it("renders https links safely", () => {
    expect(markdownToHtml("[Docs](https://example.com/ref)").trim()).toBe(
      '<p><a href="https://example.com/ref" target="_blank" rel="noopener noreferrer">Docs</a></p>',
    );
  });

  it("renders fenced code blocks", () => {
    expect(markdownToHtml("```\nRT02CR_3.12.07_260514\n```")).toContain(
      "<pre><code>RT02CR_3.12.07_260514\n</code></pre>",
    );
  });
});
