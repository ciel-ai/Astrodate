import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type Props = {
    label: string;
    variant?: 'primary' | 'secondary';
    accent?: string;
    onPress?: () => void;
    style?: ViewStyle;
};

export default function AlertButton({ label, variant = 'primary', accent = '#8B5CF6', onPress, style }: Props) {
    if (variant === 'primary') {
        return (
            <Pressable onPress={onPress} style={[styles.primaryWrap, style]} android_ripple={{ color: 'rgba(255,255,255,0.04)' }}>
                <LinearGradient colors={[accent, '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
                    <Text style={styles.primaryText}>{label}</Text>
                </LinearGradient>
            </Pressable>
        );
    }

    return (
        <Pressable onPress={onPress} style={[styles.secondary, style]} android_ripple={{ color: 'rgba(255,255,255,0.02)' }}>
            <Text style={styles.secondaryText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    primaryWrap: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
    },
    primaryGradient: {
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    primaryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    secondary: {
        width: '100%',
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(200,160,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    secondaryText: {
        color: '#EDE6FF',
        fontSize: 15,
        fontWeight: '700',
    },
});
