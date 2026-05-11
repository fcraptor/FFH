// FireFighter Helper Types

// Sub-item content for expandable sections
export interface SubItem {
  key: string;
  label: string;
  type: 'image' | 'text' | 'pdf_link';
  url?: string;
  content?: string;
}

// Image item with optional title
export interface ImageItem {
  url: string;
  title?: string;
}

// Mixed content item (combination of text and images)
export interface MixedContentPart {
  type: 'text' | 'image';
  content?: string;
  url?: string;
  title?: string;
}

export interface CalculatorContent {
  type: 'calculator';
  calculator_id: string;
  sub_items?: SubItem[];
}

// Content item can be text, image, multiple images, pdf_link, or mixed with optional sub-items
export type ContentItem =
  | { type: 'text'; content: string; sub_items?: SubItem[] }
  | { type: 'image'; url: string; title?: string; sub_items?: SubItem[] }
  | { type: 'images'; urls: ImageItem[]; sub_items?: SubItem[] }
  | { type: 'pdf_link'; url: string; sub_items?: SubItem[] }
  | { type: 'mixed'; items: MixedContentPart[]; sub_items?: SubItem[] }
  | CalculatorContent;

export interface CalculatorConfigRecord {
  [key: string]: string;
  calculator_id: string;
  calculator_name: string;
  calculator_description: string;
  formula_expression: string;
  result_label: string;
  result_unit: string;
  result_decimals: string;
  button_label: string;
  show_result_live: string;
  status: string;
}

export interface CalculatorFieldRecord {
  [key: string]: string;
  field_id: string;
  calculator_id: string;
  field_order: string;
  field_name: string;
  field_label: string;
  field_type: string;
  unit: string;
  placeholder: string;
  default_value: string;
  min_value: string;
  max_value: string;
  step_value: string;
  required: string;
  help_text: string;
  validation_message: string;
  options: string;
  status: string;
}

// Dynamic category metadata from API
export interface CategoryMetaData {
  title: string;
  key: string;
  tabs: { key: string; title: string }[];
}

export interface CategoryContent {
  _meta?: CategoryMetaData;
  [key: string]: ContentItem | CategoryMetaData | undefined;
}

// Allow dynamic category keys
export interface SzybkiPomocnikData {
  [categoryKey: string]: CategoryContent;
}

export interface ProceduraItem {
  tytul: string;
  pdf_link: string;
  ikona?: string; // Optional icon from spreadsheet
}

export interface ProcedryData {
  procedury: ProceduraItem[];
}

export interface BiuroItem {
  tytul: string;
  pdf_link: string;
}

export interface BiuroData {
  testy_wiedzy: BiuroItem;
  testy_kpp: BiuroItem;
  pogadanki_dzieci: BiuroItem;
}

export interface FavoriteItem {
  id: string;
  type: 'category' | 'card' | 'procedure' | 'biuro';
  title: string;
  category?: string;
  cardKey?: string;
  pdfLink?: string;
}

export type ThemeMode = 'light' | 'dark';
