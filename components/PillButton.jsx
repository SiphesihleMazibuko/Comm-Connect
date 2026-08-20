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
  compact = false,
}) {
  const { colors, isDark } = useTheme();

  const isDisabled = loading || disabled;

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.primaryLight,
          borderColor: colors.primaryLight,
          borderWidth: 1,
          textColor: colors.primary,
          loaderColor: colors.primary,
          shadow: false,
        };

      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary,
          borderWidth: 1.5,
          textColor: colors.primary,
          loaderColor: colors.primary,
          shadow: false,
        };

      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 1,
          textColor: colors.primary,
          loaderColor: colors.primary,
          shadow: false,
        };

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

      case 'success':
        return {
          backgroundColor: colors.success,
          borderColor: colors.success,
          borderWidth: 1,
          textColor: colors.textInverse,
          loaderColor: colors.textInverse,
          shadow: false,
        };

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
          /*
           * COMPACT:
           * No width, height or minHeight is forced.
           * The button sizes itself around the text.
           */
          width: compact ? undefined : '100%',
          alignSelf: compact ? 'flex-start' : 'stretch',

          paddingVertical: compact ? 5 : 15,
          paddingHorizontal: compact ? 11 : 24,

          borderRadius: compact ? 14 : 27,

          alignItems: 'center',
          justifyContent: 'center',

          flexDirection: 'row',
          gap: compact ? 4 : 8,

          backgroundColor: buttonStyles.backgroundColor,

          borderWidth: buttonStyles.borderWidth,
          borderColor: buttonStyles.borderColor,

          opacity: isDisabled ? 0.55 : 1,

          shadowColor: buttonStyles.shadow
            ? colors.primary
            : 'transparent',

          shadowOffset: {
            width: 0,
            height: compact ? 0 : 5,
          },

          shadowOpacity: buttonStyles.shadow
            ? isDark
              ? 0.30
              : 0.14
            : 0,

          shadowRadius: compact ? 0 : 10,

          elevation: compact
            ? 0
            : buttonStyles.shadow
              ? 4
              : 0,
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

              fontSize: compact ? 12 : 16,

              fontWeight: '700',

              letterSpacing: compact ? 0 : 0.1,

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