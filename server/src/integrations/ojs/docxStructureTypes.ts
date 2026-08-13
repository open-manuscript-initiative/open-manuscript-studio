export type OjsStructuredBlock =
  | { kind: 'paragraph'; text: string; headingLevel?: number; listLevel?: number; ordered?: boolean }
  | { kind: 'table'; cells: string[][]; headerRows: number; afterText?: string }
  | { kind: 'image'; src: string; mediaType: string; fileName: string; alt?: string; afterText?: string }
  | { kind: 'chart'; cells: string[][]; chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area'; title?: string; afterText?: string };
