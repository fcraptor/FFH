import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { CategoryTile } from '../../src/components/CategoryTile';
import { ProcedureItem } from '../../src/components/ProcedureItem';
import { CategoryConfig, categoryMetaToConfig } from '../../src/utils/categoryConfig';
import { fetchProcedury, fetchCategories } from '../../src/utils/dataService';
import { ProceduraItem } from '../../src/types';

export default function AkcjaScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pomocnik' | 'procedury'>('pomocnik');
  const [procedures, setProcedures] = useState<ProceduraItem[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'procedury') {
      loadProcedures();
    }
  }, [activeTab]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    const data = await fetchCategories();
    if (data && data.length > 0) {
      const configs = data.map(categoryMetaToConfig);
      setCategories(configs);
    }
    setCategoriesLoading(false);
  };

  const loadProcedures = async () => {
    setLoading(true);
    const data = await fetchProcedury();
    if (data && Array.isArray(data)) {
      setProcedures(data);
    }
    setLoading(false);
  };

  const handleCategoryPress = (categoryKey: string) => {
    router.push(`/akcja/szybki-pomocnik/${categoryKey}` as any);
  };

  const handleProcedurePress = (pdfLink: string, title: string) => {
    router.push({
      pathname: '/akcja/pdf-viewer',
      params: { url: pdfLink, title },
    } as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      {/* Tab Selector */}
      <View style={[styles.tabSelector, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'pomocnik' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setActiveTab('pomocnik')}
        >
          <Ionicons
            name="grid"
            size={20}
            color={activeTab === 'pomocnik' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'pomocnik' ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            Szybki pomocnik
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'procedury' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setActiveTab('procedury')}
        >
          <Ionicons
            name="document-text"
            size={20}
            color={activeTab === 'procedury' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'procedury' ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            Procedury
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'pomocnik' ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Szybki pomocnik</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Wybierz kategorię aby zobaczyć materiały
            </Text>
            {categoriesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.categoriesGrid}>
                {categories.map((cat) => (
                  <CategoryTile
                    key={cat.key}
                    id={`category-${cat.key}`}
                    title={cat.title}
                    icon={cat.icon}
                    color={cat.color}
                    onPress={() => handleCategoryPress(cat.key)}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Procedury</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Dokumenty PDF z procedurami ratowniczymi
            </Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              procedures.map((proc, index) => (
                <ProcedureItem
                  key={index}
                  id={`procedure-${index}`}
                  title={proc.tytul}
                  pdfLink={proc.pdf_link}
                  onPress={() => handleProcedurePress(proc.pdf_link, proc.tytul)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabSelector: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
