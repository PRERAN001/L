import { useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/context/ThemeContext";
import { timeAgo } from "@/lib/timeAgo";

interface FeedPostProps {
  post: any;
  colors: ThemeColors;
  onLayout: (e: LayoutChangeEvent) => void;
  onLike: (postId: string) => void;
  onOpenComments: (post: any) => void;
  onOpenProfile: (username: string) => void;
}

/**
 * A single feed post. Owns its double-tap-to-like heart burst and the
 * like-button pop animation. All data mutations are delegated to the
 * parent via callbacks so the feed keeps a single source of truth.
 */
export function FeedPost({
  post,
  colors,
  onLayout,
  onLike,
  onOpenComments,
  onOpenProfile,
}: FeedPostProps) {
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;

  const playBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, {
        toValue: 1,
        friction: 4,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(burst, {
        toValue: 0,
        duration: 250,
        delay: 450,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const popLike = () => {
    likeScale.setValue(1);
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.3,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Double-tap the photo to like (Instagram style) — never unlikes.
  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!post.isLiked) onLike(post.id);
      playBurst();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const handleLikeButton = () => {
    if (!post.isLiked) popLike();
    onLike(post.id);
  };

  const time = timeAgo(post.createdAt) || post.time || "";

  return (
    <View className="pb-3" onLayout={onLayout}>
      {/* HEADER */}
      <View className="flex-row items-center justify-between px-3 py-2.5">
        <Pressable
          onPress={() => onOpenProfile(post.username)}
          className="flex-row items-center gap-2.5"
        >
          <Image
            source={{ uri: post.profileImage }}
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: colors.card }}
          />
          <Text
            style={{ color: colors.text }}
            className="font-semibold text-[13px]"
          >
            {post.username}
          </Text>
        </Pressable>

        <Pressable hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* MEDIA — double-tap to like */}
      <Pressable onPress={handleImagePress}>
        <View
          className="w-full aspect-square"
          style={{ backgroundColor: colors.card }}
        >
          <Image
            source={{ uri: post.postImage }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <Animated.View
              style={{
                opacity: burst,
                transform: [
                  {
                    scale: burst.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              }}
            >
              <Ionicons
                name="heart"
                size={96}
                color="#FFFFFF"
                style={{
                  textShadowColor: "rgba(0,0,0,0.25)",
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 8,
                }}
              />
            </Animated.View>
          </View>
        </View>
      </Pressable>

      {/* ACTIONS */}
      <View className="flex-row items-center justify-between px-3 pt-2.5">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleLikeButton} hitSlop={6}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={post.isLiked ? "heart" : "heart-outline"}
                size={26}
                color={post.isLiked ? colors.heart : colors.text}
              />
            </Animated.View>
          </Pressable>

          <Pressable onPress={() => onOpenComments(post)} hitSlop={6}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </Pressable>

          <Pressable hitSlop={6}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Pressable hitSlop={6}>
          <Ionicons name="bookmark-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* META */}
      <View className="px-3 mt-2">
        {post.likes > 0 && (
          <Text
            style={{ color: colors.text }}
            className="font-semibold text-[13px]"
          >
            {post.likes.toLocaleString()} {post.likes === 1 ? "like" : "likes"}
          </Text>
        )}

        {post.caption ? (
          <Text
            style={{ color: colors.text }}
            className="text-[13px] mt-0.5 leading-[18px]"
          >
            <Text
              className="font-semibold"
              onPress={() => onOpenProfile(post.username)}
            >
              {post.username}
            </Text>{" "}
            {post.caption}
          </Text>
        ) : null}

        {post.commentsCount > 0 && (
          <Pressable onPress={() => onOpenComments(post)} className="mt-1">
            <Text style={{ color: colors.subtext }} className="text-[13px]">
              View all {post.commentsCount} comments
            </Text>
          </Pressable>
        )}

        {time ? (
          <Text style={{ color: colors.subtext }} className="text-[11px] mt-1">
            {time}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
