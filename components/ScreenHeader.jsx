import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { useTheme } from '../app/context/ThemeContext';

export default function ScreenHeader({
  title,
  subtitle,
  meta,
  icon,
  gradientColors,
}) {
  const { colors } = useTheme();

  const defaultGradientColors = [
    colors.gradient1,
    colors.gradient2,
  ];

  return (
    <LinearGradient
      colors={gradientColors || defaultGradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        padding: 28,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View
          style={{
            flex: 1,
            paddingRight: 16,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "bold",
              color: colors.textInverse,
            }}
          >
            {title}
          </Text>

          {subtitle && (
            <Text
              style={{
                fontSize: 14,
                color: colors.textInverse,
                opacity: 0.9,
                marginTop: 8,
              }}
            >
              {subtitle}
            </Text>
          )}

          {meta && (
            <Text
              style={{
                fontSize: 12,
                color: colors.textInverse,
                opacity: 0.7,
                marginTop: 4,
              }}
            >
              {meta}
            </Text>
          )}
        </View>

        {icon && (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: "rgba(255,255,255,0.20)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name={icon}
              size={32}
              color={colors.textInverse}
            />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}