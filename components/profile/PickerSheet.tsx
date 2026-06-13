import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { profileStyles as styles } from './profileStyles';

export interface PickerSheetProps {
  title: string;
  options: string[];
  selected: string | string[];
  onSelect: (value: string) => void;
  visible: boolean;
  onClose: () => void;
  isMultiSelect?: boolean;
  onMultiToggle?: (value: string, isSelected: boolean) => void;
}

export function PickerSheet({
  title,
  options,
  selected,
  onSelect,
  visible,
  onClose,
  isMultiSelect = false,
  onMultiToggle,
}: PickerSheetProps) {
  if (!visible) return null;

  return (
    <View style={styles.inlinePickerOverlay} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.inlinePickerBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <BlurView intensity={40} tint="dark" style={styles.pickerOverlay}>
        <LinearGradient
          colors={['rgba(26, 13, 46, 0.9)', 'rgba(45, 27, 78, 0.95)']}
          style={styles.pickerModal}
        >
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerContent}>
            {options.map((option) => {
              const isSelected = isMultiSelect
                ? (selected as string[]).includes(option)
                : selected === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    isSelected && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    if (isMultiSelect) {
                      if (onMultiToggle) {
                        onMultiToggle(option, isSelected);
                      } else {
                        onSelect(option);
                      }
                    } else {
                      onSelect(option);
                      onClose();
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isSelected && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check" size={20} color="#7C3AED" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LinearGradient>
      </BlurView>
    </View>
  );
}
