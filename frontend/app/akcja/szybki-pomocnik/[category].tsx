import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useFavorites } from '../../../src/contexts/FavoritesContext';
import { useUsage } from '../../../src/contexts/UsageContext';
import { fetchSzybkiPomocnik, getFullImageUrl } from '../../../src/utils/dataService';
import { getCategoryIcon, getCategoryColor } from '../../../src/utils/categoryConfig';
import { SzybkiPomocnikData, ContentItem, CategoryMetaData, SubItem } from '../../../src/types';
import { DynamicCalculatorScreen } from '../../../src/components/calculators/DynamicCalculatorScreen';
import { ZoomableImage } from '../../../src/components/ZoomableImage';
import { MarkdownText } from '../../../src/components/MarkdownText';

interface DynamicTab {
  key: string;
  title: string;
}

export default function CategoryDetailScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { trackUsage } = useUsage();
  const router = useRouter();
  const [data, setData] = useState<SzybkiPomocnikData | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const tabScrollRef = useRef<ScrollView>(null);
  
  // State for fullscreen image modal in KPP
  const [kppModalVisible, setKppModalVisible] = useState(false);
  const [kppModalImage, setKppModalImage] = useState<string | null>(null);
  const [kppModalTitle, setKppModalTitle] = useState<string>('');
  const [kppModalSubItems, setKppModalSubItems] = useState<SubItem[]>([]);
  const [activeSubItem, setActiveSubItem] = useState<SubItem | null>(null);

  // Dynamic config derived from data
  const [categoryConfig, setCategoryConfig] = useState<{
    key: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    tabs: DynamicTab[];
  } | null>(null);

  // Helper to open modal with content and sub-items
  const openKppModal = (imageUrl: string, title: string, subItems?: SubItem[]) => {
    setKppModalImage(imageUrl);
    setKppModalTitle(title);
    setKppModalSubItems(subItems || []);
    setActiveSubItem(null);
    setKppModalVisible(true);
  };

  // Helper to show sub-item content
  const showSubItem = (subItem: SubItem) => {
    setActiveSubItem(subItem);
  };

  // Helper to go back to main content
  const backToMain = () => {
    setActiveSubItem(null);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Track category usage when the screen is loaded
  useEffect(() => {
    if (category) {
      trackUsage(category);
    }
  }, [category, trackUsage]);

  const loadData = async () => {
    setLoading(true);
    const fetchedData = await fetchSzybkiPomocnik();
    setData(fetchedData);
    
    // Extract dynamic config from data
    if (fetchedData && category) {
      const categoryData = fetchedData[category];
      if (categoryData && categoryData._meta) {
        const meta = categoryData._meta as CategoryMetaData;
        
        // Format tab titles
        const formattedTabs = meta.tabs.map(tab => ({
          key: tab.key,
          title: tab.title
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
        }));
        
        setCategoryConfig({
          key: meta.key,
          title: meta.title.charAt(0).toUpperCase() + meta.title.slice(1),
          icon: getCategoryIcon(meta.key),
          color: getCategoryColor(meta.key, meta.title),
          tabs: formattedTabs,
        });
      }
    }
    
    setLoading(false);
  };

  const tabs = categoryConfig?.tabs ?? [];

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      Math.abs(gestureState.dx) > 24 && Math.abs(gestureState.dy) < 12
    ),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -50 && activeTabIndex < tabs.length - 1) {
        handleTabPress(activeTabIndex + 1);
      } else if (gestureState.dx > 50 && activeTabIndex > 0) {
        handleTabPress(activeTabIndex - 1);
      }
    },
  }), [activeTabIndex, tabs.length]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!categoryConfig) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Nie znaleziono kategorii</Text>
      </SafeAreaView>
    );
  }

  const categoryData = data?.[categoryConfig.key as keyof SzybkiPomocnikData];
  const currentTab = tabs[activeTabIndex];
  
  // Handle both old format (string URL) and new format (object with type)
  const rawContent = categoryData?.[currentTab?.key];
  let currentContent: ContentItem | undefined;
  
  if (rawContent && currentTab) {
    if (typeof rawContent === 'string') {
      // Old format - string URL, treat as image
      currentContent = { type: 'image', url: rawContent };
    } else if (typeof rawContent === 'object' && 'type' in rawContent) {
      // New format with type field
      currentContent = rawContent as ContentItem;
    }
  }
  
  const cardId = currentTab ? `card-${categoryConfig.key}-${currentTab.key}` : '';
  const isCardFavorite = isFavorite(cardId);
  
  // Debug log
  console.log('Category data:', { category: categoryConfig.key, tab: currentTab?.key, content: currentContent, hasData: !!categoryData });

  const handleTabPress = (index: number) => {
    setActiveTabIndex(index);
    tabScrollRef.current?.scrollTo({ x: Math.max(0, index * 120 - 24), animated: true });
  };

  const handleFavorite = () => {
    if (!currentTab) return;
    toggleFavorite({
      id: cardId,
      type: 'card',
      title: currentTab.title,
      category: categoryConfig.title,
      cardKey: currentTab.key,
    });
  };

  const isKpp = categoryConfig.key === 'kpp';

  // Handle PDF link press - navigate to PDF viewer
  const handlePdfPress = (pdfUrl: string, title: string) => {
    router.push({
      pathname: '/akcja/pdf-viewer',
      params: { url: pdfUrl, title },
    } as any);
  };

  // Helper to render content based on type
  const renderContent = (content: ContentItem | undefined, tabTitle?: string) => {
    if (!content) {
      return (
        <Text style={[styles.contentText, { color: colors.textSecondary }]}>
          Brak treści
        </Text>
      );
    }

    if (content.type === 'calculator') {
      return (
        <DynamicCalculatorScreen
          calculatorId={content.calculator_id}
          colors={colors}
        />
      );
    }

    if (content.type === 'pdf_link') {
      return (
        <TouchableOpacity
          style={[styles.pdfButton, { backgroundColor: colors.primary }]}
          onPress={() => handlePdfPress(content.url, tabTitle || currentTab?.title || 'PDF')}
        >
          <Ionicons name="document-text" size={32} color="#FFFFFF" />
          <Text style={styles.pdfButtonText}>Otwórz PDF</Text>
          <Text style={styles.pdfButtonHint}>{tabTitle || currentTab?.title || 'Dokument PDF'}</Text>
        </TouchableOpacity>
      );
    }

    if (content.type === 'image') {
      // Use the helper to get full image URL (handles proxy URLs)
      const imageUrl = getFullImageUrl(content.url);
      
      const isPlaceholder = content.url.includes('PLACEHOLDER');
      
      return (
        <View style={styles.imageContainer}>
          {/* Display title above image if available */}
          {content.title && (
            <Text style={[styles.imageTitle, { color: colors.text }]}>
              {content.title}
            </Text>
          )}
          {isPlaceholder ? (
            <View style={[styles.placeholderBox, { borderColor: colors.border }]}>
              <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.imageHint, { color: colors.textSecondary }]}>
                Obraz placeholder - wymień na prawdziwy link
              </Text>
            </View>
          ) : (
            <ZoomableImage 
              uri={imageUrl} 
              style={styles.contentImage}
              title={content.title || currentTab?.title || tabTitle || ''}
            />
          )}
        </View>
      );
    }

    // Multiple images - render all in a scrollable view
    if (content.type === 'images') {
      return (
        <View style={styles.multiImageContainer}>
          {content.urls.map((imageItem, index) => {
            // Handle both old format (string) and new format (object with url and title)
            const urlData = typeof imageItem === 'string' 
              ? { url: imageItem, title: '' } 
              : imageItem;
            const imageUrl = getFullImageUrl(urlData.url);
            const imageTitle = urlData.title || '';
            
            return (
              <View key={index} style={styles.multiImageItem}>
                {/* Display title above each image if available */}
                {imageTitle && (
                  <Text style={[styles.imageTitle, { color: colors.text }]}>
                    {imageTitle}
                  </Text>
                )}
                <ZoomableImage 
                  uri={imageUrl} 
                  style={styles.contentImage}
                  title={imageTitle || `${currentTab?.title || tabTitle || ''} (${index + 1}/${content.urls.length})`}
                />
                <Text style={[styles.imageCounter, { color: colors.textSecondary }]}>
                  {index + 1} / {content.urls.length}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }

    // Mixed content - combination of text and images
    if (content.type === 'mixed') {
      return (
        <View style={styles.mixedContentContainer}>
          {content.items.map((item, index) => {
            if (item.type === 'text' && item.content) {
              return (
                <View key={index} style={styles.mixedTextItem}>
                  <MarkdownText content={item.content} fontSize={15} />
                </View>
              );
            } else if (item.type === 'image' && item.url) {
              const imageUrl = getFullImageUrl(item.url);
              return (
                <View key={index} style={styles.mixedImageItem}>
                  {item.title && (
                    <Text style={[styles.imageTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                  )}
                  <ZoomableImage 
                    uri={imageUrl} 
                    style={styles.contentImage}
                    title={item.title || tabTitle || ''}
                  />
                </View>
              );
            }
            return null;
          })}
        </View>
      );
    }

    // type === 'text'
    return (
      <MarkdownText content={content.content} fontSize={15} />
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}
      {...(!isKpp ? panResponder.panHandlers : {})}
    >
      {/* Header with category info */}
      <View style={[styles.header, { backgroundColor: categoryConfig.color }]}>
        <View style={styles.headerContent}>
          <Ionicons name={categoryConfig.icon} size={32} color="#FFFFFF" />
          <Text style={styles.headerTitle}>{categoryConfig.title}</Text>
        </View>
      </View>

      {isKpp ? (
        // KPP - Vertical list view
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {tabs.map((tab, index) => {
            const itemId = `card-${categoryConfig.key}-${tab.key}`;
            const rawItemContent = categoryData?.[tab.key];
            
            // Handle both old format (string URL) and new format (object with type)
            let itemContent: ContentItem | undefined;
            if (rawItemContent) {
              if (typeof rawItemContent === 'string') {
                itemContent = { type: 'image', url: rawItemContent };
              } else if (typeof rawItemContent === 'object' && 'type' in rawItemContent) {
                itemContent = rawItemContent as ContentItem;
              }
            }
            
            const itemIsFav = isFavorite(itemId);

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.kppItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  // Open modal with zoomable image for KPP items
                  if (itemContent && itemContent.type === 'image' && itemContent.url) {
                    openKppModal(
                      getFullImageUrl(itemContent.url),
                      tab.title,
                      itemContent.sub_items
                    );
                  }
                }}
              >
                {/* Thumbnail icon or default icon */}
                {itemContent && itemContent.type === 'image' && itemContent.url ? (
                  <View style={[styles.kppThumbnailContainer, { borderColor: categoryConfig.color }]}>
                    <Image
                      source={{ uri: getFullImageUrl(itemContent.url) }}
                      style={styles.kppThumbnail}
                      resizeMode="cover"
                    />
                    {/* Show badge if has sub-items */}
                    {itemContent.sub_items && itemContent.sub_items.length > 0 && (
                      <View style={[styles.subItemBadge, { backgroundColor: categoryConfig.color }]}>
                        <Text style={styles.subItemBadgeText}>+{itemContent.sub_items.length}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.kppItemIcon, { backgroundColor: categoryConfig.color }]}>
                    <Ionicons name="medkit" size={20} color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.kppItemContent}>
                  <Text style={[styles.kppItemTitle, { color: colors.text }]}>{tab.title}</Text>
                  {itemContent && itemContent.type === 'text' && (
                    <View style={styles.kppItemPreview}>
                      <MarkdownText content={itemContent.content} fontSize={13} />
                    </View>
                  )}
                  {itemContent && itemContent.type === 'image' && (
                    <Text style={[styles.kppImageHint, { color: colors.textSecondary }]}>
                      Kliknij aby zobaczyć
                    </Text>
                  )}
                </View>
                <View style={styles.kppItemActions}>
                  {itemContent && itemContent.type === 'image' && (
                    <Ionicons name="expand-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  )}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite({
                        id: itemId,
                        type: 'card',
                        title: tab.title,
                        category: categoryConfig.title,
                        cardKey: tab.key,
                      });
                    }}
                    style={styles.favoriteBtn}
                  >
                    <Ionicons
                      name={itemIsFav ? 'star' : 'star-outline'}
                      size={22}
                      color={itemIsFav ? colors.accent : colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        // Other categories - Horizontal tabs with card
        <>
          {/* Horizontal Tab Bar */}
          <ScrollView
            ref={tabScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabBar, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.tabBarContent}
          >
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={tab.key}
                testID={`category-tab-${tab.key}`}
                style={[
                  styles.tab,
                  activeTabIndex === index && { backgroundColor: colors.primary },
                ]}
                onPress={() => handleTabPress(index)}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTabIndex === index ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Content Card */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {currentTab && (
              <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{currentTab.title}</Text>
                  <TouchableOpacity onPress={handleFavorite} style={styles.favoriteBtn}>
                    <Ionicons
                      name={isCardFavorite ? 'star' : 'star-outline'}
                      size={26}
                      color={isCardFavorite ? colors.accent : colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardContent}>
                  {renderContent(currentContent)}
                </View>
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* Fullscreen Image Modal for KPP */}
      <Modal
        visible={kppModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (activeSubItem) {
            backToMain();
          } else {
            setKppModalVisible(false);
          }
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            {activeSubItem && (
              <TouchableOpacity 
                style={styles.modalBackBtn}
                onPress={backToMain}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.modalTitle}>
              {activeSubItem ? activeSubItem.label : kppModalTitle}
            </Text>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setKppModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          {/* Main content or sub-item content */}
          {activeSubItem ? (
            // Show sub-item content
            activeSubItem.type === 'image' && activeSubItem.url ? (
              <View style={styles.modalImage}>
                <Image
                  source={{ uri: getFullImageUrl(activeSubItem.url) }}
                  style={styles.kppFullscreenImage}
                  resizeMode="contain"
                />
              </View>
            ) : activeSubItem.type === 'text' && activeSubItem.content ? (
              <ScrollView style={styles.modalTextContent}>
                <MarkdownText content={activeSubItem.content} fontSize={16} />
              </ScrollView>
            ) : null
          ) : (
            // Show main content with sub-item buttons
            <>
              {kppModalImage && (
                <View style={kppModalSubItems.length > 0 ? styles.modalImageWithButtons : styles.modalImage}>
                  <Image
                    source={{ uri: kppModalImage }}
                    style={styles.kppFullscreenImage}
                    resizeMode="contain"
                  />
                </View>
              )}
              
              {/* Sub-item buttons */}
              {kppModalSubItems.length > 0 && (
                <View style={styles.subItemButtonsContainer}>
                  {kppModalSubItems.map((subItem) => (
                    <TouchableOpacity
                      key={subItem.key}
                      style={[styles.subItemButton, { backgroundColor: categoryConfig?.color || colors.primary }]}
                      onPress={() => showSubItem(subItem)}
                    >
                      <Ionicons 
                        name={subItem.type === 'image' ? 'image' : subItem.type === 'pdf_link' ? 'document' : 'text'} 
                        size={20} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.subItemButtonText}>{subItem.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tabBar: {
    maxHeight: 52,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  contentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    minHeight: 300,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  favoriteBtn: {
    padding: 4,
  },
  cardContent: {
    flex: 1,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  contentImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    width: '100%',
  },
  imageHint: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  kppItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  kppItemIcon: {
    borderRadius: 10,
    padding: 10,
    marginRight: 14,
  },
  kppItemContent: {
    flex: 1,
  },
  kppItemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  kppItemPreview: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  kppItemImage: {
    width: '100%',
    height: 120,
    marginTop: 8,
    borderRadius: 8,
  },
  kppItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  pdfButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    gap: 12,
  },
  pdfButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pdfButtonHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  kppImageContainer: {
    marginTop: 8,
  },
  kppZoomHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  kppZoomHintText: {
    fontSize: 11,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalImage: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageWithButtons: {
    flex: 1,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTextContent: {
    flex: 1,
    padding: 16,
  },
  kppFullscreenImage: {
    width: '100%',
    height: '100%',
  },
  subItemButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 0,
    gap: 12,
    justifyContent: 'center',
  },
  subItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    minWidth: 140,
    justifyContent: 'center',
  },
  subItemButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subItemBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subItemBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  kppThumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    position: 'relative',
  },
  kppThumbnail: {
    width: '100%',
    height: '100%',
  },
  kppImageHint: {
    fontSize: 12,
    marginTop: 2,
  },
  multiImageContainer: {
    gap: 24,
  },
  multiImageItem: {
    marginBottom: 8,
  },
  imageCounter: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  imageTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  mixedContentContainer: {
    gap: 16,
  },
  mixedTextItem: {
    marginBottom: 8,
  },
  mixedImageItem: {
    marginVertical: 12,
  },
});
