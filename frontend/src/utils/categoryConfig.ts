import { Ionicons } from '@expo/vector-icons';
import { CategoryMeta } from './dataService';

export interface CategoryConfig {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tabs: { key: string; title: string }[];
}

// Default icon and color mapping for known categories (fallback if no icon in spreadsheet)
const iconMapping: Record<string, keyof typeof Ionicons.glyphMap> = {
  woda: 'water',
  piana: 'cloud',
  chemia: 'flask',
  adr: 'warning',
  lpr: 'airplane',
  kpp: 'medkit',
  lacznosc: 'radio',
  promieniowanie: 'nuclear',
  kdr: 'people',
};

const colorMapping: Record<string, string> = {
  woda: '#2196F3',
  piana: '#9C27B0',
  chemia: '#FF9800',
  adr: '#F44336',
  lpr: '#00BCD4',
  kpp: '#E91E63',
  lacznosc: '#607D8B',
  promieniowanie: '#FFEB3B',
  kdr: '#795548',
};

// Default fallback icon and color for unknown categories
const DEFAULT_ICON: keyof typeof Ionicons.glyphMap = 'folder-outline';
const DEFAULT_COLOR = '#4CAF50';

// Generate color based on category name for new categories
const generateColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
};

// Convert CategoryMeta from API to CategoryConfig for UI
export const categoryMetaToConfig = (meta: CategoryMeta): CategoryConfig => {
  // Priority: 1) icon from spreadsheet, 2) hardcoded mapping, 3) default
  let icon: keyof typeof Ionicons.glyphMap;
  if (meta.ikona && meta.ikona.trim()) {
    icon = meta.ikona as keyof typeof Ionicons.glyphMap;
  } else {
    icon = iconMapping[meta.key] || DEFAULT_ICON;
  }
  
  const color = colorMapping[meta.key] || generateColor(meta.title);
  
  // Capitalize title if it comes lowercase from API
  const title = meta.title.charAt(0).toUpperCase() + meta.title.slice(1);
  
  // Format tab titles - capitalize first letter and replace underscores
  const tabs = meta.tabs.map(tab => ({
    key: tab.key,
    title: tab.title
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
  }));
  
  return {
    key: meta.key,
    title,
    icon,
    color,
    tabs,
  };
};

// Get icon for a category key
export const getCategoryIcon = (key: string): keyof typeof Ionicons.glyphMap => {
  return iconMapping[key] || DEFAULT_ICON;
};

// Get color for a category key
export const getCategoryColor = (key: string, title?: string): string => {
  return colorMapping[key] || (title ? generateColor(title) : DEFAULT_COLOR);
};
