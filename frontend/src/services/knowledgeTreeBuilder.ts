// ============================================================
// KNOWLEDGE BASE - TREE BUILDER & DATA TRANSFORM
// Transforms flat list to tree and builds search index
// ============================================================

import {
  KnowledgeNode,
  KnowledgeFlatNode,
  KnowledgeIndexItem,
} from '../types/knowledge';

// ============================================================
// FLAT LIST -> TREE TRANSFORMATION
// ============================================================

export const buildTreeFromFlatList = (flatNodes: KnowledgeFlatNode[]): KnowledgeNode[] => {
  // Create a map for quick lookup
  const nodeMap = new Map<string, KnowledgeNode>();
  const rootNodes: KnowledgeNode[] = [];

  // First pass: create all nodes with empty children arrays
  for (const flatNode of flatNodes) {
    const node: KnowledgeNode = {
      ...flatNode,
      children: [],
    };
    nodeMap.set(node.id, node);
  }

  // Second pass: build parent-child relationships
  for (const flatNode of flatNodes) {
    const node = nodeMap.get(flatNode.id);
    if (!node) continue;

    if (flatNode.parent_id === null || flatNode.parent_id === '') {
      // Root node
      rootNodes.push(node);
    } else {
      // Child node - find parent and add to children
      const parent = nodeMap.get(flatNode.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    }
  }

  // Sort all children by sort_order, then by title
  const sortChildren = (nodes: KnowledgeNode[]): void => {
    nodes.sort((a, b) => {
      // For non-section items in the same folder: folders first, then sections/files/links by sort_order
      const isAFolder = a.type === 'folder';
      const isBFolder = b.type === 'folder';
      
      // Folders always come first (before sections and content)
      if (isAFolder && !isBFolder) return -1;
      if (!isAFolder && isBFolder) return 1;
      
      // For items of the same "folder" status, sort by sort_order to preserve DOM order
      // This keeps sections in their correct position relative to files/links
      const orderA = a.sort_order ?? 999;
      const orderB = b.sort_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;

      // Then by title as fallback
      return (a.title || '').localeCompare(b.title || '', 'pl');
    });

    // Recursively sort children
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  };

  sortChildren(rootNodes);

  return rootNodes;
};

// ============================================================
// BUILD SEARCH INDEX FROM TREE
// ============================================================

export const buildSearchIndex = (tree: KnowledgeNode[]): KnowledgeIndexItem[] => {
  const index: KnowledgeIndexItem[] = [];

  const traverseTree = (
    nodes: KnowledgeNode[],
    pathParts: string[] = []
  ): void => {
    for (const node of nodes) {
      const currentPath = [...pathParts, node.title];

      // Only index files and links (not folders)
      if ((node.type === 'file' || node.type === 'link') && node.url) {
        const pathString = currentPath.join(' > ');
        
        // Extract category, page, section from path
        const category = currentPath[0] || '';
        const page = currentPath[1] || '';
        const section = currentPath.length > 2 ? currentPath.slice(2, -1).join(' > ') : '';

        // Build search text for fast matching
        const searchText = [
          node.title,
          node.description,
          pathString,
          category,
          page,
          section,
          node.extension,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        index.push({
          id: node.id,
          title: node.title,
          label: node.description,
          type: node.type as 'file' | 'link',
          url: node.url,
          extension: node.extension,
          category,
          page,
          section,
          path: pathString,
          searchText,
        });
      }

      // Recurse into children
      if (node.children && node.children.length > 0) {
        traverseTree(node.children, currentPath);
      }
    }
  };

  traverseTree(tree);

  return index;
};

// ============================================================
// SEARCH IN INDEX
// ============================================================

export const searchKnowledgeIndex = (
  index: KnowledgeIndexItem[],
  query: string
): KnowledgeIndexItem[] => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/);

  // Score-based search for better results
  const scoredResults = index
    .map((item) => {
      let score = 0;

      // Check if all query words are present
      const allWordsMatch = queryWords.every((word) =>
        item.searchText.includes(word)
      );

      if (!allWordsMatch) {
        return { item, score: 0 };
      }

      // Exact title match (highest score)
      if (item.title.toLowerCase().includes(normalizedQuery)) {
        score += 100;
      }

      // Title contains query words
      for (const word of queryWords) {
        if (item.title.toLowerCase().includes(word)) {
          score += 20;
        }
      }

      // Category match
      if (item.category?.toLowerCase().includes(normalizedQuery)) {
        score += 10;
      }

      // Path match
      if (item.path.toLowerCase().includes(normalizedQuery)) {
        score += 5;
      }

      return { item, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item);

  return scoredResults;
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export const countTreeItems = (tree: KnowledgeNode[]): { folders: number; files: number; links: number } => {
  let folders = 0;
  let files = 0;
  let links = 0;

  const traverse = (nodes: KnowledgeNode[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case 'folder':
          folders++;
          break;
        case 'file':
          files++;
          break;
        case 'link':
          links++;
          break;
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  };

  traverse(tree);
  return { folders, files, links };
};

export const findNodeById = (tree: KnowledgeNode[], id: string): KnowledgeNode | null => {
  for (const node of tree) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const getNodePath = (tree: KnowledgeNode[], targetId: string): string[] => {
  const path: string[] = [];

  const traverse = (nodes: KnowledgeNode[], currentPath: string[]): boolean => {
    for (const node of nodes) {
      const newPath = [...currentPath, node.title];
      if (node.id === targetId) {
        path.push(...newPath);
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (traverse(node.children, newPath)) {
          return true;
        }
      }
    }
    return false;
  };

  traverse(tree, []);
  return path;
};
