// Utils/globalStyles.js
import { StyleSheet } from 'react-native';

export const dramaticGlobal = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  neonGlow: {
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  gradientText: {
    background: 'linear-gradient(135deg, #6D28D9 0%, #F43F5E 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
});