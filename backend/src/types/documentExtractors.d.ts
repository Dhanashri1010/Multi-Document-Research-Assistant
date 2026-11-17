declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  export function extractRawText(input: { path?: string; buffer?: Buffer }): Promise<MammothResult>;
  export function convertToMarkdown(input: { path?: string; buffer?: Buffer }): Promise<MammothResult>;
  export function convertToHtml(input: { path?: string; buffer?: Buffer }): Promise<MammothResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
    convertToMarkdown: typeof convertToMarkdown;
    convertToHtml: typeof convertToHtml;
  };
  export default mammoth;
}

declare module 'word-extractor' {
  export interface WordDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(options?: any): string;
    getFooters(): string;
    getAnnotations(): string;
    getTextboxes(options?: any): string;
  }
  export default class WordExtractor {
    extract(input: string | Buffer): Promise<WordDocument>;
  }
}
