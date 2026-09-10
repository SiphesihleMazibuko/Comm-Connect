import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ImageBackground,
  Text,
  View,
} from "react-native";
import { useTheme } from "../app/context/ThemeContext";

export default function ScreenHeader({
  title,
  subtitle,
  meta,
  icon,
}) {
  const { colors, isDark } = useTheme();

  // Text colours for the two header images
  const headerTextColor = isDark
    ? colors.textInverse
    : colors.text;

  const headerSecondaryTextColor = isDark
    ? colors.textInverse
    : colors.textLight;

  return (
    
<ImageBackground
  source={
    isDark
      ? require("../assets/header-dark.png")
      : require("../assets/header-light.png")
  }
  resizeMode="cover"
  imageStyle={{
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    opacity: 1,
  }}
  style={{
    padding: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",

    // Solid background behind the image
    backgroundColor: isDark
      ? "#071A12"
      : "#00C853",
  }}
>
      {/* HEADER CONTENT */}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >

        {/* TEXT */}

        <View
          style={{
            flex: 1,
            paddingRight: 16,
          }}
        >

          {/* TITLE */}

          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: headerTextColor,
            }}
          >
            {title}
          </Text>


          {/* SUBTITLE */}

          {subtitle && (
            <Text
              style={{
                fontSize: 14,
                color: headerSecondaryTextColor,
                opacity: 0.9,
                marginTop: 8,
              }}
            >
              {subtitle}
            </Text>
          )}


          {/* META */}

          {meta && (
            <Text
              style={{
                fontSize: 12,
                color: headerSecondaryTextColor,
                opacity: 0.75,
                marginTop: 4,
              }}
            >
              {meta}
            </Text>
          )}

        </View>


        {/* ICON */}

        {icon && (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,

              backgroundColor: isDark
                ? "rgba(255,255,255,0.20)"
                : "rgba(0,0,0,0.08)",

              justifyContent: "center",
              alignItems: "center",
            }}
          >

            <Ionicons
              name={icon}
              size={32}
              color={headerTextColor}
            />

          </View>
        )}

      </View>

    </ImageBackground>
  );
}