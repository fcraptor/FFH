// ============================================================
// KNOWLEDGE BASE - TYPES
// ============================================================

// Tree node type
export type KnowledgeNodeType = 'folder' | 'file' | 'link' | 'section';

// Target type for files/links
export type KnowledgeTargetType = 'pdf' | 'pptx' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'gov_page' | 'external_page' | 'video' | 'other';

// Tree node structure
export interface KnowledgeNode {
  id: string;
  parent_id: string | null;
  title: string;
  type: KnowledgeNodeType;
  url?: string;
  path: string;
  source?: string;
  updated_at?: string;
  target_type?: KnowledgeTargetType;
  extension?: string;
  description?: string;
  sort_order?: number;
  children?: KnowledgeNode[];
}

// Flat node from API (before tree building)
export interface KnowledgeFlatNode {
  id: string;
  parent_id: string | null;
  title: string;
  type: KnowledgeNodeType;
  url?: string;
  path: string;
  source?: string;
  updated_at?: string;
  target_type?: KnowledgeTargetType;
  extension?: string;
  description?: string;
  sort_order?: number;
}

// Searchable index item
export interface KnowledgeIndexItem {
  id: string;
  title: string;
  label?: string;
  type: 'file' | 'link';
  url: string;
  extension?: string;
  category?: string;
  page?: string;
  section?: string;
  path: string;
  searchText: string; // lowercase concatenation for fast search
}

// Sync metadata
export interface KnowledgeSyncMeta {
  lastSync: string | null;
  lastSyncSuccess: boolean;
  itemCount: number;
  version?: string;
}

// API response structure
export interface KnowledgeApiResponse {
  version?: string;
  updated_at?: string;
  nodes: KnowledgeFlatNode[];
}

// Cache structure
export interface KnowledgeCacheData {
  tree: KnowledgeNode[];
  index: KnowledgeIndexItem[];
  meta: KnowledgeSyncMeta;
}
