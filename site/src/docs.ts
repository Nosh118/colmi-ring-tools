import { Marked } from "marked";

export interface DocPage {
  id: string;
  title: string;
  path: string;
}

export const DOC_PAGES: DocPage[] = [
  { id: "flashing", title: "Flashing", path: "./docs/flashing.md" },
  { id: "midi", title: "MIDI", path: "./docs/midi.md" },
  { id: "firmware", title: "Firmware", path: "./docs/findings.md" },
  { id: "acknowledgements", title: "Thanks", path: "./docs/acknowledgements.md" },
];

export async function fetchDocHtml(page: DocPage): Promise<string> {
  const response = await fetch(page.path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${page.title}: HTTP ${response.status}`);
  return markdownToHtml(await response.text());
}

const markdownRenderer = new Marked({
  async: false,
  breaks: false,
  gfm: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
      const externalAttributes = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(href)}"${titleAttribute}${externalAttributes}>${label}</a>`;
    },
  },
});

export function markdownToHtml(markdown: string): string {
  return markdownRenderer.parse(markdown) as string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
