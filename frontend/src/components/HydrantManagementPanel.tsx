import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  HydrantWithDistance,
  ReferencePoint,
  formatDistance,
  getHydrantDescription,
} from '../utils/hydrants';

export type HydrantSelectionMode = 'geolocation' | 'map-point';

interface Colors {
  background: string;
  border: string;
  card: string;
  error: string;
  primary: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent?: string;
}

interface HydrantManagementPanelProps {
  colors: Colors;
  selectionMode: HydrantSelectionMode;
  referencePoint: ReferencePoint | null;
  nearestHydrants: HydrantWithDistance[];
  selectedHydrantId: string | null;
  loading: boolean;
  errorMessage: string;
  totalCount: number;
  onSelectGeolocation: () => void;
  onSelectMapPoint: () => void;
  onHydrantPress: (hydrant: HydrantWithDistance) => void;
  onRetryFetch: () => void;
}

export function HydrantManagementPanel({
  colors,
  selectionMode,
  referencePoint,
  nearestHydrants,
  selectedHydrantId,
  loading,
  errorMessage,
  totalCount,
  onSelectGeolocation,
  onSelectMapPoint,
  onHydrantPress,
  onRetryFetch,
}: HydrantManagementPanelProps) {
  const renderStatusRow = () => {
    if (loading) {
      return (
        <View style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.text }]}>Pobieranie hydrantów…</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <Ionicons name="cloud-offline" size={18} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error }]}>{errorMessage}</Text>
          <TouchableOpacity
            testID="hydrant-retry-button"
            onPress={onRetryFetch}
            style={[styles.retryBtn, { borderColor: colors.error }]}
          >
            <Ionicons name="refresh" size={14} color={colors.error} />
            <Text style={[styles.retryBtnText, { color: colors.error }]}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!referencePoint) {
      return (
        <View style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {selectionMode === 'geolocation'
              ? 'Pobieram twoją lokalizację, aby pokazać najbliższe hydranty.'
              : 'Wskaż punkt na mapie, aby policzyć odległości.'}
          </Text>
        </View>
      );
    }

    if (totalCount === 0) {
      return (
        <View style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Brak hydrantów w aktualnym widoku mapy. Oddal lub przesuń mapę i spróbuj ponownie.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="water" size={18} color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.text }]}>
          Znaleziono {totalCount} {totalCount === 1 ? 'hydrant' : 'hydrantów'} w obszarze.
          {referencePoint.source === 'gps' ? ' Punkt odniesienia: GPS.' : ' Punkt odniesienia: wskazany na mapie.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="hydrant-management-panel">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Punkt odniesienia</Text>

      <View style={styles.modeButtons}>
        <TouchableOpacity
          testID="hydrant-mode-geolocation"
          style={[
            styles.modeButton,
            { borderColor: colors.border },
            selectionMode === 'geolocation' && {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            },
          ]}
          onPress={onSelectGeolocation}
        >
          <Ionicons
            name="locate"
            size={20}
            color={selectionMode === 'geolocation' ? '#FFFFFF' : colors.text}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: selectionMode === 'geolocation' ? '#FFFFFF' : colors.text },
            ]}
          >
            Moja lokalizacja
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="hydrant-mode-map-point"
          style={[
            styles.modeButton,
            { borderColor: colors.border },
            selectionMode === 'map-point' && {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            },
          ]}
          onPress={onSelectMapPoint}
        >
          <Ionicons
            name="location"
            size={20}
            color={selectionMode === 'map-point' ? '#FFFFFF' : colors.text}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: selectionMode === 'map-point' ? '#FFFFFF' : colors.text },
            ]}
          >
            Wskaż na mapie
          </Text>
        </TouchableOpacity>
      </View>

      {renderStatusRow()}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Najbliższe hydranty</Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        {nearestHydrants.length === 0 && !loading ? (
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            {referencePoint
              ? 'Brak hydrantów do wyświetlenia.'
              : 'Wybierz punkt odniesienia, aby zobaczyć listę.'}
          </Text>
        ) : null}

        {nearestHydrants.map((hydrant) => {
          const isActive = hydrant.id === selectedHydrantId;
          const description = getHydrantDescription(hydrant);

          return (
            <TouchableOpacity
              key={hydrant.id}
              testID={`hydrant-item-${hydrant.id}`}
              style={[
                styles.listItem,
                {
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onHydrantPress(hydrant)}
            >
              <View
                style={[
                  styles.listIcon,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.primary },
                ]}
              >
                <Ionicons name="water" size={18} color="#FFFFFF" />
              </View>

              <View style={styles.listText}>
                <Text
                  style={[
                    styles.listTitle,
                    { color: isActive ? '#FFFFFF' : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {hydrant.label}
                </Text>

                {description ? (
                  <Text
                    style={[
                      styles.listSubtitle,
                      { color: isActive ? 'rgba(255,255,255,0.85)' : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {description}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.listSubtitle,
                      { color: isActive ? 'rgba(255,255,255,0.85)' : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {hydrant.lat.toFixed(5)}, {hydrant.lng.toFixed(5)}
                  </Text>
                )}
              </View>

              <Text
                style={[
                  styles.listDistance,
                  { color: isActive ? '#FFFFFF' : colors.primary },
                ]}
              >
                {formatDistance(hydrant.distanceMeters)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.attribution, { color: colors.textSecondary }]}>
        Dane: © OpenStreetMap contributors
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 0,
    marginBottom: 4,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    gap: 6,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    marginBottom: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
  },
  emptyHint: {
    fontSize: 13,
    paddingVertical: 12,
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  listIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  listSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  listDistance: {
    fontSize: 13,
    fontWeight: '800',
  },
  attribution: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 4,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  debugText: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  forceFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  forceFetchBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});