import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '../app/context/ThemeContext';

export default function GlossyCard({
  children,
  style,
  noPadding = false,
  variant = 'default',
}) {
  const { colors, isDark } = useTheme();

  const variants = {
    default: {
      background: isDark
        ? [colors.surfaceLight, colors.surface]
        : ['#FFFFFF', colors.surfaceLight],
      border: colors.border,
    },

    elevated: {
      background: isDark
        ? ['#1F2937', colors.surface]
        : ['#FFFFFF', '#FFFFFF'],
      border: colors.border,
    },

    outlined: {
      background: [colors.surface, colors.surface],
      border: colors.primary,
    },

    highlight: {
      background: isDark
        ? ['rgba(108,99,255,0.16)', colors.surface]
        : ['#F7F5FF', '#FFFFFF'],
      border: colors.primary,
    },

    danger: {
      background: isDark
        ? ['rgba(239,68,68,0.14)', colors.surface]
        : ['#FFF5F5', '#FFFFFF'],
      border: colors.error,
    },

    success: {
      background: isDark
        ? ['rgba(34,197,94,0.14)', colors.surface]
        : ['#F0FDF4', '#FFFFFF'],
      border: colors.success,
    },
  };

  const currentVariant = variants[variant] || variants.default;

  return (
    <View
      style={{
        marginVertical: 8,
        borderRadius: 24,

        shadowColor: isDark
          ? '#000000'
          : colors.primary,

        shadowOffset: {
          width: 0,
          height: 6,
        },

        shadowOpacity: isDark ? 0.28 : 0.08,
        shadowRadius: isDark ? 16 : 12,

        elevation: isDark ? 6 : 3,
      }}
    >
      <LinearGradient
        colors={currentVariant.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          borderWidth: 1,
          borderColor: currentVariant.border,
          overflow: 'hidden',

          padding: noPadding ? 0 : 20,

          ...style,
        }}
      >
        {/* Subtle glass shine */}
        <LinearGradient
          pointerEvents="none"
          colors={
            isDark
              ? [
                  'rgba(255,255,255,0.055)',
                  'rgba(255,255,255,0.018)',
                  'rgba(255,255,255,0)',
                ]
              : [
                  'rgba(255,255,255,0.70)',
                  'rgba(255,255,255,0.22)',
                  'rgba(255,255,255,0)',
                ]
          }
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.7 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '45%',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        />

        {/* Content layer */}
        <View
          style={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}