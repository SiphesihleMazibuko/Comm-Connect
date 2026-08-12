import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';

import { useTheme } from '../app/context/ThemeContext';

export default function PillButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}) {
  const { colors, isDark } = useTheme();

  const isDisabled = loading || disabled;

  const getVariantStyles = () => {
    switch (variant) {
      // ─────────────────────────────────────
      // SECONDARY
      // ─────────────────────────────────────
      case 'secondary':
        return {
          backgroundColor: colors.primaryLight,
          borderColor: colors.primaryLight,
          borderWidth: 1,
          textColor: colors.primary,
          loaderColor: colors.primary,
          shadow: false,
        };

      // ─────────────────────────────────────
      // OUTLINE
      // ─────────────────────────────────────
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary,
          borderWidth: 1.5,
          textColor: colors.primary,
          loaderColor: colors.primary,
          shadow: false,
        };

      // ─────────────────────────────────────
      // GHOST
      // ─────────────────────────────────────
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 1,
          textColor: colors.primary,
          loaderColor: colors.primary,
          shadow: false,
        };

      // ─────────────────────────────────────
      // EMERGENCY / DANGER
      // ─────────────────────────────────────
      case 'emergency':
      case 'danger':
        return {
          backgroundColor: colors.error,
          borderColor: colors.error,
          borderWidth: 1,
          textColor: colors.textInverse,
          loaderColor: colors.textInverse,
          shadow: false,
        };

      // ─────────────────────────────────────
      // SUCCESS
      // ─────────────────────────────────────
      case 'success':
        return {
          backgroundColor: colors.success,
          borderColor: colors.success,
          borderWidth: 1,
          textColor: colors.textInverse,
          loaderColor: colors.textInverse,
          shadow: false,
        };

      // ─────────────────────────────────────
      // PRIMARY
      // ─────────────────────────────────────
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          borderWidth: 1,
          textColor: colors.textInverse,
          loaderColor: colors.textInverse,
          shadow: true,
        };
    }
  };

  const buttonStyles = getVariantStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          width: '100%',
          minHeight: 54,

          paddingVertical: 15,
          paddingHorizontal: 24,

          borderRadius: 27,

          alignItems: 'center',
          justifyContent: 'center',

          flexDirection: 'row',
          gap: 8,

          backgroundColor: buttonStyles.backgroundColor,

          borderWidth: buttonStyles.borderWidth,
          borderColor: buttonStyles.borderColor,

          opacity: isDisabled ? 0.55 : 1,

          // Primary button gets the brand glow.
          shadowColor: buttonStyles.shadow
            ? colors.primary
            : 'transparent',

          shadowOffset: {
            width: 0,
            height: 5,
          },

          shadowOpacity: buttonStyles.shadow
            ? isDark
              ? 0.30
              : 0.14
            : 0,

          shadowRadius: buttonStyles.shadow ? 10 : 0,

          elevation: buttonStyles.shadow ? 4 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={buttonStyles.loaderColor}
        />
      ) : (
        <Text
          style={[
            {
              color: buttonStyles.textColor,
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 0.1,
              textAlign: 'center',
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
