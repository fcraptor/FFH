import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ProcedureItem } from '../../src/components/ProcedureItem';
import { fetchProcedury } from '../../src/utils/dataService';
import { ProceduraItem } from '../../src/types';

export default function ProceduryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [procedures, setProcedures] = useState<ProceduraItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProcedures();
  }, []);

  const loadProcedures = async () => {
    setLoading(true);
    const data = await fetchProcedury();
    if (data && Array.isArray(data)) {
      setProcedures(data);
    }
    setLoading(false);
  };

  const handleProcedurePress = (pdfLink: string, title: string) => {
    router.push({
      pathname: '/akcja/pdf-viewer',
      params: { url: pdfLink, title },
    } as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
              icon={proc.ikona}
              onPress={() => handleProcedurePress(proc.pdf_link, proc.tytul)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
