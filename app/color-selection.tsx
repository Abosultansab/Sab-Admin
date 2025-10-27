import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PRODUCT_COLORS } from '../constants/productColors';

export default function ColorSelection() {
  const router = useRouter();

  const handleSelectColor = (color: string) => {
    // You can pass the selected color back via router or context
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a Color</Text>
      <FlatList
        data={PRODUCT_COLORS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.colorItem, { backgroundColor: item.hex }]}
            onPress={() => handleSelectColor(item.value)}
          >
            <Text style={styles.colorName}>{item.nameEn}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  colorItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  colorName: {
    color: '#333',
    fontWeight: '500',
  },
});
