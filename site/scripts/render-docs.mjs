import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(siteRoot, "..");
const sourceDocsDir = resolve(repoRoot, "docs");
const publicDocsDir = resolve(siteRoot, "public/docs");

const DOCS = [
  { source: "flashing.md", output: "flashing" },
  { source: "midi.md", output: "midi" },
  { source: "findings.md", output: "findings" },
  { source: "acknowledgements.md", output: "acknowledgements" },
];

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

await mkdir(publicDocsDir, { recursive: true });

for (const doc of DOCS) {
  const markdown = await readFile(resolve(sourceDocsDir, doc.source), "utf8");
  await writeFile(resolve(publicDocsDir, `${doc.output}.md`), markdown);
  await writeFile(resolve(publicDocsDir, `${doc.output}.html`), renderMarkdown(markdown));
}

console.log(`Rendered ${DOCS.length} docs.`);

function renderMarkdown(markdown) {
  return markdownRenderer.parse(markdown);
}

function escapeHtml(value) {
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
