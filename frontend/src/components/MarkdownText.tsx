import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import Markdown from '@ronradtke/react-native-markdown-display';
import { useTheme } from '../contexts/ThemeContext';

interface MarkdownTextProps {
  content: string;
  fontSize?: number;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, fontSize = 15 }) => {
  const { colors } = useTheme();

  // Process content - convert common patterns to proper markdown
  let processedContent = content;
  
  // Convert literal \n to actual newlines
  processedContent = processedContent.replace(/\\n/g, '\n');
  
  // Split by newlines and process each line
  const lines = processedContent.split('\n').map(line => {
    const trimmedLine = line.trim();
    // Convert asterisk without space to bullet
    if (trimmedLine.startsWith('*') && !trimmedLine.startsWith('* ') && !trimmedLine.startsWith('**')) {
      return '• ' + trimmedLine.slice(1).trim();
    }
    // Convert dash without space to bullet
    if (trimmedLine.startsWith('-') && !trimmedLine.startsWith('- ')) {
      return '• ' + trimmedLine.slice(1).trim();
    }
    return line;
  });
  
  processedContent = lines.join('\n');

  const markdownStyles = StyleSheet.create({
    body: {
      color: colors.text,
      fontSize: fontSize,
      lineHeight: fontSize * 1.6,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    heading1: {
      color: colors.text,
      fontSize: fontSize * 1.6,
      fontWeight: '700',
      marginBottom: 12,
      marginTop: 16,
    },
    heading2: {
      color: colors.text,
      fontSize: fontSize * 1.4,
      fontWeight: '700',
      marginBottom: 10,
      marginTop: 14,
    },
    heading3: {
      color: colors.text,
      fontSize: fontSize * 1.2,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 12,
    },
    strong: {
      fontWeight: '700',
      color: colors.text,
    },
    em: {
      fontStyle: 'italic',
    },
    bullet_list: {
      marginLeft: 0,
    },
    ordered_list: {
      marginLeft: 0,
    },
    list_item: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    bullet_list_icon: {
      color: colors.primary,
      fontSize: fontSize,
      marginRight: 8,
    },
    ordered_list_icon: {
      color: colors.primary,
      fontSize: fontSize,
      marginRight: 8,
      fontWeight: '600',
    },
    code_inline: {
      backgroundColor: colors.surface,
      color: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: fontSize * 0.9,
    },
    code_block: {
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    blockquote: {
      backgroundColor: colors.surface,
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 16,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: colors.surface,
    },
    th: {
      padding: 8,
      fontWeight: '600',
    },
    td: {
      padding: 8,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
  });

  return (
    <Markdown style={markdownStyles}>
      {processedContent}
    </Markdown>
  );
};
