import React from 'react';
import { View, TextInput, StyleSheet, I18nManager } from 'react-native';
import { Search } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Theme from '@/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Search size={20} color={Colors.textLight} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder || 'بحث - Search'}
        placeholderTextColor={Colors.textLight}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.lg,
    height: 48,
    ...Theme.shadow.sm,
  },
  icon: {
    marginRight: I18nManager.isRTL ? 0 : Theme.spacing.sm,
    marginLeft: I18nManager.isRTL ? Theme.spacing.sm : 0,
  },
  input: {
    flex: 1,
    fontSize: Theme.fontSize.lg,
    color: Colors.text,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
});
