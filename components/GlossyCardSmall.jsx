import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '../app/context/ThemeContext';

export default function GlossyCardSmall({
  children,
  style,
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

    highlight: {
      background: isDark
        ? ['rgba(108,99,255,0.14)', colors.surface]
        : ['#F7F5FF', '#FFFFFF'],
      border: colors.primary,
    },

    danger: {
      background: isDark
        ? ['rgba(239,68,68,0.12)', colors.surface]
        : ['#FFF5F5', '#FFFFFF'],
      border: colors.error,
    },

    success: {
      background: isDark
        ? ['rgba(34,197,94,0.12)', colors.surface]
        : ['#F0FDF4', '#FFFFFF'],
      border: colors.success,
    },

    outlined: {
      background: [colors.surface, colors.surface],
      border: colors.border,
    },
  };

  const currentVariant =
    variants[variant] || variants.default;

  return (
    <View
      style={{
        marginVertical: 6,
        borderRadius: 16,

        shadowColor: isDark
          ? '#000000'
          : colors.primary,

        shadowOffset: {
          width: 0,
          height: 4,
        },

        shadowOpacity: isDark ? 0.22 : 0.06,
        shadowRadius: isDark ? 10 : 8,

        elevation: isDark ? 4 : 2,
      }}
    >
      <LinearGradient
        colors={currentVariant.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: currentVariant.border,

          padding: 12,

          overflow: 'hidden',

          ...style,
        }}
      >
        {/* Subtle glass shine */}
        <LinearGradient
          pointerEvents="none"
          colors={
            isDark
              ? [
                  'rgba(255,255,255,0.045)',
                  'rgba(255,255,255,0.015)',
                  'rgba(255,255,255,0)',
                ]
              : [
                  'rgba(255,255,255,0.65)',
                  'rgba(255,255,255,0.18)',
                  'rgba(255,255,255,0)',
                ]
          }
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.7 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',

            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }}
        />

        {/* Content */}
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