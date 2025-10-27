import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Colors from '@/constants/colors';
import Theme from '@/constants/theme';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'transparent';
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function IconButton({
  icon,
  onPress,
  variant = 'transparent',
  size = 40,
  disabled = false,
  style,
}: IconButtonProps) {
  const getBackgroundColor = () => {
    if (disabled) return Colors.border;
    
    switch (variant) {
      case 'primary':
        return Colors.primary;
      case 'secondary':
        return Colors.secondary;
      case 'danger':
        return Colors.danger;
      case 'success':
        return Colors.success;
      case 'transparent':
        return Colors.background;
      default:
        return Colors.background;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
