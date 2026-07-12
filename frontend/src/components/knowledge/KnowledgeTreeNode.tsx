// ============================================================
// KNOWLEDGE TREE NODE COMPONENT
// Renders a single node with expand/collapse functionality
// ============================================================

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KnowledgeNode } from '../../types/knowledge';

interface KnowledgeTreeNodeProps {
  node: KnowledgeNode;
  level: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onOpenItem: (node: KnowledgeNode) => void;
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    card: string;
    surface: string;
  };
}

const getNodeIcon = (node: KnowledgeNode, isExpanded: boolean): keyof typeof Ionicons.glyphMap => {
  if (node.type === 'folder') {
    return isExpanded ? 'folder-open' : 'folder';
  }
  if (node.type === 'section') {
    return 'bookmark';
  }
  if (node.type === 'link') {
    return 'link';
  }
  // File type - check extension
  const ext = node.extension?.toLowerCase();
  if (ext === 'pdf') return 'document-text';
  if (ext === 'pptx' || ext === 'ppt') return 'easel';
  if (ext === 'doc' || ext === 'docx') return 'document';
  if (ext === 'xls' || ext === 'xlsx') return 'grid';
  if (ext === 'mp4' || ext === 'avi' || ext === 'mov') return 'videocam';
  return 'document-outline';
};

const getNodeIconColor = (node: KnowledgeNode, colors: KnowledgeTreeNodeProps['colors']): string => {
  if (node.type === 'folder') return '#FFA000'; // Amber for folders
  if (node.type === 'section') return '#7B1FA2'; // Purple for sections
  if (node.type === 'link') return '#2196F3'; // Blue for links
  
  const ext = node.extension?.toLowerCase();
  if (ext === 'pdf') return '#E53935'; // Red for PDF
  if (ext === 'pptx' || ext === 'ppt') return '#FB8C00'; // Orange for PowerPoint
  if (ext === 'doc' || ext === 'docx') return '#1E88E5'; // Blue for Word
  if (ext === 'xls' || ext === 'xlsx') return '#43A047'; // Green for Excel
  
  return colors.primary;
};

function KnowledgeTreeNodeComponent({
  node,
  level,
  expandedIds,
  onToggleExpand,
  onOpenItem,
  colors,
}: KnowledgeTreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder';
  const isSection = node.type === 'section';
  const iconName = getNodeIcon(node, isExpanded);
  const iconColor = getNodeIconColor(node, colors);

  const handlePress = () => {
    if (isSection) {
      // Sections are non-interactive separators
      return;
    }
    if (isFolder && hasChildren) {
      onToggleExpand(node.id);
    } else if (node.type === 'file' || node.type === 'link') {
      onOpenItem(node);
    }
  };

  // Render section as non-interactive header
  if (isSection) {
    return (
      <View style={[styles.sectionRow, { paddingLeft: 16 + level * 20 }]}>
        <View style={styles.sectionLine} />
        <View style={[styles.sectionIconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={iconName} size={14} color={iconColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: iconColor }]}>
          {node.title}
        </Text>
        <View style={styles.sectionLine} />
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.nodeRow,
          { paddingLeft: 16 + level * 20 },
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Expand/Collapse indicator for folders */}
        {isFolder && hasChildren ? (
          <View style={styles.expandIndicator}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        ) : (
          <View style={styles.expandIndicator} />
        )}

        {/* Node icon */}
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>

        {/* Node title */}
        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.nodeTitle,
              { color: colors.text },
              isFolder && styles.folderTitle,
            ]}
            numberOfLines={2}
          >
            {node.title}
          </Text>
          
          {/* Extension badge for files */}
          {node.extension && node.type === 'file' && (
            <View style={[styles.extensionBadge, { backgroundColor: iconColor + '20' }]}>
              <Text style={[styles.extensionText, { color: iconColor }]}>
                {node.extension.toUpperCase()}
              </Text>
            </View>
          )}
          
          {/* External link indicator */}
          {node.type === 'link' && (
            <Ionicons
              name="open-outline"
              size={14}
              color={colors.textSecondary}
              style={styles.externalIcon}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children!.map((child) => (
            <KnowledgeTreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onOpenItem={onOpenItem}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export const KnowledgeTreeNode = memo(KnowledgeTreeNodeComponent);

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#7B1FA220',
  },
  sectionIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 16,
  },
  expandIndicator: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nodeTitle: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  folderTitle: {
    fontWeight: '600',
  },
  extensionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extensionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  externalIcon: {
    marginLeft: 4,
  },
  childrenContainer: {
    // Children are indented via paddingLeft in nodeRow
  },
});
