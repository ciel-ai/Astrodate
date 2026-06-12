import { Platform, type ViewStyle } from 'react-native';

export const TAB_BAR_BASE_STYLE: ViewStyle = {
  backgroundColor: Platform.OS === 'ios' ? 'rgba(26, 11, 46, 0.95)' : 'rgba(26, 11, 46, 0.95)',
  borderTopWidth: 0,
  borderTopColor: 'transparent',
  height: 60,
  paddingBottom: 0,
  paddingTop: 0,
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  justifyContent: 'center',
  alignItems: 'center',
};

