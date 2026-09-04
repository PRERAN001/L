import { View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/context/ThemeContext";

interface StoryRingProps {
  image: string;
  /** "Your Story" style: neutral ring + blue "+" badge */
  own?: boolean;
  /** already-viewed story: muted gray ring */
  seen?: boolean;
  /** avatar diameter (the ring adds a few px around it) */
  size?: number;
  colors: ThemeColors;
}

/**
 * Instagram story avatar with the signature gradient-style ring.
 *
 * React Native has no CSS gradients, so we approximate Instagram's
 * pink→orange→purple ring by giving a circular border four different
 * side colors and rotating it 45° — the rounded corners blend the
 * colors into a convincing multi-color ring, with zero native deps.
 */
export function StoryRing({
  image,
  own = false,
  seen = false,
  size = 64,
  colors,
}: StoryRingProps) {
  const ringWidth = 2.5;
  const gap = 2.5;
  const outer = size + (ringWidth + gap) * 2;

  return (
    <View
      style={{
        width: outer,
        height: outer,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ring */}
      {own || seen ? (
        <View
          style={{
            position: "absolute",
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: ringWidth,
            borderColor: seen ? colors.border : colors.subtext,
          }}
        />
      ) : (
        <View
          style={{
            position: "absolute",
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: ringWidth,
            borderTopColor: "#FEDA75",
            borderRightColor: "#FA7E1E",
            borderBottomColor: "#D62976",
            borderLeftColor: "#962FBF",
            transform: [{ rotate: "45deg" }],
          }}
        />
      )}

      {/* Gap + avatar */}
      <View
        style={{
          backgroundColor: colors.background,
          borderRadius: (size + gap * 2) / 2,
          padding: gap,
        }}
      >
        <Image
          source={{ uri: image }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.card,
          }}
        />
      </View>

      {/* "+" badge for your own story */}
      {own && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 2,
            backgroundColor: colors.background,
            borderRadius: 999,
            padding: 1,
          }}
        >
          <Ionicons name="add-circle" size={20} color={colors.accent} />
        </View>
      )}
    </View>
  );
}
