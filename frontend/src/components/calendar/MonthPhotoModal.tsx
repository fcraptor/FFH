import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZoomableImage } from './ZoomableImage';

interface Props {
  visible: boolean;
  isDark: boolean;
  monthLabel: string;
  photoBase64?: string;
  onClose: () => void;
  onPickFromGallery: (base64: string) => void;
  onTakePhoto: (base64: string) => void;
  onRemove: () => void;
}

export function MonthPhotoModal({
  visible,
  isDark,
  monthLabel,
  photoBase64,
  onClose,
  onPickFromGallery,
  onTakePhoto,
  onRemove,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Brak uprawnień', 'Aplikacja potrzebuje dostępu do galerii zdjęć.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets[0] && res.assets[0].base64) {
        onPickFromGallery(res.assets[0].base64);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Błąd', 'Nie udało się wybrać zdjęcia.');
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Brak uprawnień', 'Aplikacja potrzebuje dostępu do aparatu.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets[0] && res.assets[0].base64) {
        onTakePhoto(res.assets[0].base64);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Błąd', 'Nie udało się zrobić zdjęcia.');
    }
  };

  if (photoBase64) {
    // Tryb pełnoekranowy ze zoomem
    // Oblicz wysokość dla zdjęcia - zostawiam miejsce na header, przyciski zoom i akcje
    const imageHeight = screenH - 280;
    
    return (
      <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
        <SafeAreaView style={[styles.fullscreen, { backgroundColor: '#000000' }]} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.fullTopBar}>
            <Text style={styles.fullTitle} numberOfLines={1}>
              Grafik · {monthLabel}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.fullClose}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.zoomArea}>
            <ZoomableImage
              uri={`data:image/jpeg;base64,${photoBase64}`}
              width={screenW - 16}
              height={imageHeight}
            />
          </View>

          <View style={styles.fullHint}>
            <Ionicons name="resize-outline" size={16} color="#FFFFFF" />
            <Text style={styles.fullHintText}>Użyj przycisków +/- lub rozsuń palce</Text>
          </View>

          <View style={styles.fullActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#C8102E' }]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Nowe zdjęcie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#1565C0' }]}
              onPress={pickFromGallery}
            >
              <Ionicons name="images" size={18} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Z galerii</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#424242' }]}
              onPress={() => {
                Alert.alert('Usuń zdjęcie', `Usunąć zdjęcie grafiku ${monthLabel}?`, [
                  { text: 'Anuluj', style: 'cancel' },
                  {
                    text: 'Usuń',
                    style: 'destructive',
                    onPress: () => onRemove(),
                  },
                ]);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Tryb karty - brak zdjęcia
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              Grafik · {monthLabel}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#1A1A1A'} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.placeholder,
              { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5' },
            ]}
          >
            <Ionicons name="image-outline" size={48} color={isDark ? '#666666' : '#B0B0B0'} />
            <Text style={[styles.placeholderText, { color: isDark ? '#B0B0B0' : '#666666' }]}>
              Brak zdjęcia grafiku{`\n`}dla tego miesiąca
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#C8102E' }]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Zrób zdjęcie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#1565C0' }]}
              onPress={pickFromGallery}
            >
              <Ionicons name="images" size={18} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Z galerii</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: { padding: 4 },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderText: {
    fontSize: 13,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    justifyContent: 'center',
  },
  // Tryb pełnoekranowy
  fullscreen: { flex: 1 },
  fullTopBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  fullClose: { padding: 6 },
  zoomArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  fullHint: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  fullHintText: {
    color: '#CCCCCC',
    fontSize: 11,
  },
  fullActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
