import { GENERATED_DOC_PAGES } from "./generated/docs";

export interface DocPage {
  id: string;
  title: string;
  html: string;
}

export const DOC_PAGES: DocPage[] = [...GENERATED_DOC_PAGES];

export function docHtml(page: DocPage): string {
  return page.html;
}
