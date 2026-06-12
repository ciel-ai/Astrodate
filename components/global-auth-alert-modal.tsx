import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { ALERT_THEME, ALERT_VARIANTS } from '@/constants/alert-theme';
import { useAuthAlert } from '@/lib/auth-alert-context';
import AlertButton from './ui/AlertButton';

type AuthAlertAction = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

export function GlobalAuthAlertModal() {
    const { alertConfig, hideAlert } = useAuthAlert();

    const scale = useSharedValue(0.86);
    const opacity = useSharedValue(0);
    const iconPulse = useSharedValue(0.8);

    useEffect(() => {
        if (alertConfig.visible) {
            opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
            scale.value = withSpring(1, { damping: 16, stiffness: 140 });
            iconPulse.value = withDelay(120, withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.quad) }));
        } else {
            opacity.value = withTiming(0, { duration: 180 });
            scale.value = withTiming(0.92, { duration: 180 });
            iconPulse.value = withTiming(0.92, { duration: 180 });
        }
    }, [alertConfig.visible]);

    const wrapperStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconPulse.value }],
        shadowOpacity: iconPulse.value > 1 ? 0.9 : 0.5,
    }));

    const actions = alertConfig.actions && alertConfig.actions.length > 0 ? alertConfig.actions : [{ text: 'OK' }];

    const variant = ALERT_VARIANTS[alertConfig.variant || 'info'];

    const handleAction = (action: AuthAlertAction) => {
        hideAlert();
        action.onPress?.();
    };

    return (
        <Modal
            transparent
            visible={alertConfig.visible}
            animationType="none"
            presentationStyle="overFullScreen"
            statusBarTranslucent
            onRequestClose={hideAlert}
        >
            <View style={styles.overlay} pointerEvents="box-none">
                <Pressable style={StyleSheet.absoluteFill} onPress={hideAlert} />
                <LinearGradient colors={ALERT_THEME.backdropGradient as any} style={StyleSheet.absoluteFill} />

                <Animated.View style={[styles.cardShell, wrapperStyle]}>
                    <LinearGradient colors={variant.borderGradient as any} style={styles.borderGlow}>
                        <LinearGradient colors={ALERT_THEME.cardGradient as any} style={styles.card}>
                            <Animated.View style={[styles.iconWrap, iconStyle]}>
                                <LinearGradient colors={variant.iconGradient as any} style={styles.iconBadge}>
                                    <MaterialIcons name={variant.icon} size={32} color="#fff" />
                                </LinearGradient>
                            </Animated.View>

                            <Text style={styles.title}>{alertConfig.title}</Text>
                            <Text style={styles.message}>{alertConfig.message}</Text>

                            <View style={styles.actions}>
                                {actions.map((action, i) => (
                                    <AlertButton
                                        key={`${action.text}-${i}`}
                                        label={action.text}
                                        variant={i === actions.length - 1 ? 'primary' : 'secondary'}
                                        accent={variant.accent}
                                        onPress={() => handleAction(action)}
                                    />
                                ))}
                            </View>
                        </LinearGradient>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'relative',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(3, 1, 8, 0.72)',
        pointerEvents: 'box-none',
    },
    ambientOrbTop: {
        position: 'absolute',
        top: '18%',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(168, 85, 247, 0.22)',
        shadowColor: '#A855F7',
        shadowOpacity: 0.8,
        shadowRadius: 44,
        zIndex: 1,
    },
    ambientOrbBottom: {
        position: 'absolute',
        bottom: '14%',
        right: 28,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        shadowColor: '#EC4899',
        shadowOpacity: 0.65,
        shadowRadius: 38,
        zIndex: 1,
    },
    particle: {
        position: 'absolute',
        backgroundColor: '#E9D5FF',
        shadowColor: '#D8B4FE',
        shadowOpacity: 1,
        shadowRadius: 8,
        zIndex: 2,
    },
    cardShell: {
        position: 'relative',
        zIndex: 3,
        width: '100%',
        maxWidth: 380,
        shadowColor: '#A855F7',
        shadowOpacity: 0.45,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 18 },
        elevation: 24,
    },
    borderGlow: {
        borderRadius: 30,
        padding: 1.4,
    },
    card: {
        borderRadius: 29,
        paddingHorizontal: 22,
        paddingTop: 28,
        paddingBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
    },
    iconWrap: {
        alignItems: 'center',
        marginBottom: 18,
    },
    iconBadge: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#C084FC',
        shadowOpacity: 0.9,
        shadowRadius: 24,
        elevation: 12,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0,
        marginBottom: 10,
    },
    message: {
        color: '#C9BFE0',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    actions: {
        gap: 10,
    },
    actionButton: {
        borderRadius: 18,
        overflow: 'hidden',
    },
    primaryButtonShadow: {
        shadowColor: '#C084FC',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    actionGradient: {
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    secondaryButton: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(216, 180, 254, 0.22)',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    primaryText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    secondaryText: {
        color: '#DDD6FE',
        fontSize: 15,
        fontWeight: '700',
    },
});
