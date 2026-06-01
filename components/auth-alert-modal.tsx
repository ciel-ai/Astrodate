import { StyleSheet } from 'react-native';

type AuthAlertAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AuthAlertModalProps = {
  visible: boolean;
  title: string;
  message: string;
  actions?: AuthAlertAction[];
  onClose: () => void;
};

const PARTICLES = [
  { left: '10%', top: '18%', size: 3, opacity: 0.55 },
  { left: '22%', top: '76%', size: 2, opacity: 0.45 },
  { left: '78%', top: '20%', size: 4, opacity: 0.5 },
  { left: '88%', top: '66%', size: 2, opacity: 0.35 },
  { left: '50%', top: '10%', size: 2, opacity: 0.4 },
  { left: '62%', top: '84%', size: 3, opacity: 0.45 },
] as const;

export function AuthAlertModal(_props: AuthAlertModalProps) {
  // Deprecated compatibility wrapper — global alerts now render from AuthAlertProvider.
  // This component intentionally renders nothing to avoid any native Alert usage.
  return null;
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
