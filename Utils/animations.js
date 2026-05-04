import { StyleSheet } from 'react-native';

export const animations = {
  hover: {
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  press: {
    transform: [{ scale: 0.98 }],
  },
  glow: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
  },
  slideUp: {
    transform: [{ translateY: -5 }],
  },
};

export const dramaticStyles = StyleSheet.create({
  gradientCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    background: 'linear-gradient(135deg, rgba(109,40,217,0.2) 0%, rgba(244,63,94,0.2) 100%)',
  },
  neonText: {
    textShadowColor: '#F43F5E',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  pulseBorder: {
    borderWidth: 2,
    borderColor: '#F43F5E',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});