import React, { useState, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PowiatEntry, getAllPowiats } from '../utils/hydrants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (powiat: PowiatEntry) => void;
  colors: any;
}

export const CountySelectionModal = ({ visible, onClose, onSelect, colors }: Props) => {
  const [search, setSearch] = useState('');
  const powiats = useMemo(() => getAllPowiats(), []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return powiats;
    return powiats.filter(p => 
      p.displayName.toLowerCase().includes(q) || 
      p.teryt.includes(q)
    );
  }, [search, powiats]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Wybierz powiat ręcznie</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Szukaj powiatu lub TERYT..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.teryt}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.item, { borderBottomColor: colors.border }]}
                onPress={() => onSelect(item)}
              >
                <Text style={[styles.itemText, { color: colors.text }]}>{item.displayName}</Text>
                <Text style={[styles.teryt, { color: colors.textSecondary }]}>TERYT: {item.teryt}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 15 },
  input: { flex: 1, height: 44, marginLeft: 8 },
  item: { paddingVertical: 15, borderBottomWidth: 1 },
  itemText: { fontSize: 16, fontWeight: '500' },
  teryt: { fontSize: 12, marginTop: 2 }
});
