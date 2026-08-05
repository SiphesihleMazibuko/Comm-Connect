import { StyleSheet } from 'react-native';

export const dramaticGlobal = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(28, 37, 65, 0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#5bc0be',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  neonGlow: {
    shadowColor: '#5bc0be',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  gradientText: {
    background: 'linear-gradient(135deg, #3a506b 0%, #5bc0be 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
});
