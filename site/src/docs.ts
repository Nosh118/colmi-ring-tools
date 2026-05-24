export interface DocPage {
  id: string;
  title: string;
  path: string;
  sourcePath: string;
}

export const DOC_PAGES: DocPage[] = [
  { id: "flashing", title: "Flashing", path: "./docs/flashing.html", sourcePath: "./docs/flashing.md" },
  { id: "midi", title: "MIDI", path: "./docs/midi.html", sourcePath: "./docs/midi.md" },
  { id: "firmware", title: "Firmware", path: "./docs/findings.html", sourcePath: "./docs/findings.md" },
  {
    id: "acknowledgements",
    title: "Thanks",
    path: "./docs/acknowledgements.html",
    sourcePath: "./docs/acknowledgements.md",
  },
];

export async function fetchDocHtml(page: DocPage): Promise<string> {
  const response = await fetch(page.path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${page.title}: HTTP ${response.status}`);
  return response.text();
}
