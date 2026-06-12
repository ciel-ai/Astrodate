export const ALERT_THEME = {
    backdropGradient: ['rgba(6,4,10,0.86)', 'rgba(18,8,30,0.78)', 'rgba(8,6,12,0.9)'],
    cardGradient: ['rgba(12,6,20,0.56)', 'rgba(8,6,12,0.48)'],
    borderGlowFallback: ['#A855F7', '#8B5CF6', '#EC4899'],
    spacing: {
        xsmall: 8,
        small: 12,
        base: 16,
        large: 24,
        xlarge: 32,
    },
    typography: {
        titleSize: 20,
        bodySize: 15,
        titleWeight: '800',
        bodyWeight: '600',
    },
};

export const ALERT_VARIANTS: Record<string, any> = {
    error: {
        icon: 'error-outline',
        accent: '#FF5C8A',
        borderGradient: ['#FF5C8A', '#C026D3'],
        iconGradient: ['#FF9CCF', '#FF5C8A'],
    },
    success: {
        icon: 'check-circle-outline',
        accent: '#2CE69B',
        borderGradient: ['#2CE69B', '#00C2FF'],
        iconGradient: ['#A7F3D0', '#10B981'],
    },
    warning: {
        icon: 'warning-amber-outline',
        accent: '#FFD36E',
        borderGradient: ['#FFD36E', '#FF9F43'],
        iconGradient: ['#FFE7B6', '#FFD36E'],
    },
    info: {
        icon: 'info-outline',
        accent: '#8B5CF6',
        borderGradient: ['#8B5CF6', '#C084FC'],
        iconGradient: ['#D6BCFA', '#8B5CF6'],
    },
    otp: {
        icon: 'sms',
        accent: '#7CE0FF',
        borderGradient: ['#7CE0FF', '#8B5CF6'],
        iconGradient: ['#CFF8FF', '#7CE0FF'],
    },
};

export type AlertVariant = keyof typeof ALERT_VARIANTS;
