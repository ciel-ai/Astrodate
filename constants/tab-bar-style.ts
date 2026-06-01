import { Platform, type ViewStyle } from 'react-native';

const PURPLE_GLOW = '#A855F7';

export const TAB_BAR_BASE_STYLE: ViewStyle = {
  backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(26, 11, 46, 0.95)',
  borderTopWidth: 0,
  borderTopColor: 'transparent',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.1)',
  height: 60,
  paddingBottom: 0,
  paddingTop: 0,
  borderRadius: 30,
  marginHorizontal: 24,
  marginBottom: Platform.OS === 'ios' ? 28 : 20,
  position: 'absolute',
  justifyContent: 'center',
  ...Platform.select({
    ios: {
      shadowColor: '#A855F7',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 0,
    },
    android: {
      elevation: 8,
      shadowColor: '#A855F7',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
  }),
};

