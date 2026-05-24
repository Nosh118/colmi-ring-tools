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

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listTag: "ul" | "ol" | null = null;
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listTag) return;
    html.push(`<${listTag}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${listTag}>`);
    listItems = [];
    listTag = null;
  };
  const flushBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushBlocks();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushBlocks();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushBlocks();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = /^-\s+(.+)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      if (listTag !== "ul") flushList();
      listTag = "ul";
      listItems.push(unordered[1]);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (listTag !== "ol") flushList();
      listTag = "ol";
      listItems.push(ordered[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushBlocks();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>");
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
