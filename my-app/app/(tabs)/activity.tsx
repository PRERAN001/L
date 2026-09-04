import { useState, useCallback, useRef, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  Image,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/timeAgo";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface ReelItemProps {
  item: any;
  shouldPlay: boolean;
  onLikeToggle: (id: string) => void;
  onOpenComments: (item: any) => void;
  onShare: (id: string) => void;
}

function ReelItem({ item, shouldPlay, onLikeToggle, onOpenComments, onShare }: ReelItemProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const playIconTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoUriRef = useRef<string>(item.video);

  const player = useVideoPlayer(videoUriRef.current, (p) => {
    p.loop = true;
    p.muted = false;
    p.audioMixingMode = "auto";
  });

  const playerRef = useRef(player);

  useEffect(() => {
    if (shouldPlay) {
      playerRef.current.muted = isMuted;
      playerRef.current.play();
    } else {
      playerRef.current.pause();
    }
  }, [shouldPlay]);

  useEffect(() => {
    playerRef.current.muted = isMuted;
  }, [isMuted]);

  const handleVideoPress = () => {
    if (playerRef.current.playing) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    setShowPlayIcon(true);
    if (playIconTimeout.current) clearTimeout(playIconTimeout.current);
    playIconTimeout.current = setTimeout(() => setShowPlayIcon(false), 700);
  };

  const handleMuteToggle = () => setIsMuted((prev) => !prev);

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH, backgroundColor: "#000" }}>
      <StatusBar hidden />

      <Pressable
        onPress={handleVideoPress}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="cover"
          nativeControls={false}
        />

        {showPlayIcon && (
          <View
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.45)",
                borderRadius: 999,
                padding: 16,
              }}
            >
              <Ionicons
                name={playerRef.current.playing ? "pause" : "play"}
                size={40}
                color="white"
              />
            </View>
          </View>
        )}
      </Pressable>

      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300 }}
      >
        <View style={{ flex: 1, opacity: 0,    backgroundColor: "#000" }} />
        <View style={{ flex: 1, opacity: 0.12, backgroundColor: "#000" }} />
        <View style={{ flex: 1, opacity: 0.40, backgroundColor: "#000" }} />
        <View style={{ flex: 1, opacity: 0.68, backgroundColor: "#000" }} />
      </View>

      <View style={{ position: "absolute", top: 52, left: 16, right: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", letterSpacing: 0.5 }}>
            Reels
          </Text>
          <Pressable onPress={handleMuteToggle} hitSlop={10}>
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={24}
              color="white"
            />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          right: 12,
          bottom: 110,
          alignItems: "center",
          gap: 24,
        }}
      >
        <Pressable
          onPress={() => onLikeToggle(item.id)}
          style={{ alignItems: "center" }}
          hitSlop={8}
        >
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={32}
            color={item.isLiked ? "#ef4444" : "white"}
          />
          <Text style={{ color: "white", fontSize: 12, marginTop: 4, fontWeight: "600" }}>
            {item.likes > 999 ? `${(item.likes / 1000).toFixed(1)}k` : item.likes}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onOpenComments(item)}
          style={{ alignItems: "center" }}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={30} color="white" />
          <Text style={{ color: "white", fontSize: 12, marginTop: 4, fontWeight: "600" }}>
            {(item.commentsCount ?? 0) > 999
              ? `${(item.commentsCount / 1000).toFixed(1)}k`
              : item.commentsCount ?? 0}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onShare(item.id)}
          style={{ alignItems: "center" }}
          hitSlop={8}
        >
          <Ionicons
            name={item.isShared ? "paper-plane" : "paper-plane-outline"}
            size={30}
            color={item.isShared ? "#38bdf8" : "white"}
          />
          {item.isShared && (
            <Text style={{ color: "#38bdf8", fontSize: 10, marginTop: 2, fontWeight: "600" }}>
              Shared
            </Text>
          )}
        </Pressable>

        <Pressable hitSlop={8}>
          <Ionicons name="bookmark-outline" size={30} color="white" />
        </Pressable>

        <Pressable hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={28} color="white" />
        </Pressable>
      </View>

      <View style={{ position: "absolute", left: 14, right: 68, bottom: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          {item.profileImage ? (
            <Image
              source={{ uri: item.profileImage }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#374151", marginRight: 10 }}
            />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#4B5563", marginRight: 10 }} />
          )}

          <Text
            style={{ color: "white", fontWeight: "bold", fontSize: 15, flexShrink: 1, marginRight: 8 }}
            numberOfLines={1}
          >
            @{item.username}
          </Text>

          <Pressable
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.8)",
              borderRadius: 6,
              paddingHorizontal: 12,
              paddingVertical: 3,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Follow</Text>
          </Pressable>
        </View>

        {!!item.caption && (
          <Text
            style={{ color: "white", fontSize: 13, fontWeight: "500", lineHeight: 19, marginBottom: 8 }}
            numberOfLines={3}
          >
            {item.caption}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="musical-notes" size={13} color="rgba(255,255,255,0.85)" />
          <Text
            style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginLeft: 6 }}
            numberOfLines={1}
          >
            Original audio · @{item.username}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function Activity() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [reelsList, setReelsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeReelForComments, setActiveReelForComments] = useState<any | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const fetchReels = useCallback(async (cursor?: string | null) => {
    try {
      if (!cursor) setLoading(true);
      else setLoadingMore(true);

      const token = await getTokenRef.current();
      const endpoint = cursor ? `/feed/reels?cursor=${encodeURIComponent(cursor)}` : "/feed/reels";
      const res = await apiFetch(endpoint, {}, token);

      const fetched = Array.isArray(res)
        ? res
        : Array.isArray(res?.reels)
        ? res.reels
        : [];

      const mapped = fetched.map((r: any) => ({
        id: r._id || r.id,
        video: r.mediaUrl || r.video,
        username: r.username || r.user?.username || "user",
        profileImage: r.profileImage || r.user?.profileImage || null,
        caption: r.caption || "",
        likes: r.likes ?? r.likesCount ?? 0,
        isLiked: r.isLiked || false,
        isShared: false,
        commentsCount: r.commentsCount ?? r.comments?.length ?? 0,
      }));

      if (cursor) {
        setReelsList((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const uniqueNew = mapped.filter((r) => !existingIds.has(r.id));
          return [...prev, ...uniqueNew];
        });
      } else {
        setReelsList(mapped);
      }

      setNextCursor(res.nextCursor || String(mapped.length));
      setHasMore(res.hasMore ?? true);
    } catch (err) {
      console.log("Error fetching reels:", err);
      if (!cursor) setReelsList([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      setActiveIndex(0);
      fetchReels();

      return () => {
        setIsTabFocused(false);
      };
    }, [fetchReels])
  );

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchReels(nextCursor);
    }
  }, [loadingMore, hasMore, nextCursor, fetchReels]);

  const handleLikeToggle = async (reelId: string) => {
    setReelsList((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        const newIsLiked = !r.isLiked;
        return { ...r, isLiked: newIsLiked, likes: newIsLiked ? r.likes + 1 : Math.max(0, r.likes - 1) };
      })
    );
    try {
      const token = await getTokenRef.current();
      await apiFetch(`/feed/${reelId}/like`, { method: "POST" }, token);
    } catch (err) {
      console.log("Error toggling reel like:", err);
    }
  };

  const handleShare = async (reelId: string) => {
    setReelsList((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        return { ...r, isShared: !r.isShared };
      })
    );
    try {
      const token = await getTokenRef.current();
      await apiFetch(`/feed/${reelId}/share`, { method: "POST" }, token);
    } catch (err) {
      console.log("Error sharing reel:", err);
    }
  };

  const handleOpenComments = async (reel: any) => {
    setActiveReelForComments(reel);
    setCommentsList([]);
    setLoadingComments(true);

    try {
      const token = await getTokenRef.current();
      const res = await apiFetch(`/feed/${reel.id}/comments`, {}, token);
      if (res && Array.isArray(res.comments)) {
        setCommentsList(res.comments);
      }
    } catch (err) {
      console.log("Error fetching reel comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim() || !activeReelForComments) return;

    const textToSend = commentInput.trim();
    setCommentInput("");

    try {
      setSubmittingComment(true);
      const token = await getTokenRef.current();
      const res = await apiFetch(
        `/feed/${activeReelForComments.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ text: textToSend }),
        },
        token
      );

      if (res && res.comment) {
        setCommentsList((prev) => [...prev, res.comment]);
        setReelsList((prev) =>
          prev.map((r) =>
            r.id === activeReelForComments.id
              ? { ...r, commentsCount: (r.commentsCount || 0) + 1 }
              : r
          )
        );
      } else {
        const mockNewComment = {
          _id: Date.now().toString(),
          user: {
            username: user?.username || "you",
            name: user?.fullName || "You",
            profileImage: user?.imageUrl,
          },
          text: textToSend,
          createdAt: new Date().toISOString(),
        };
        setCommentsList((prev) => [...prev, mockNewComment]);
        setReelsList((prev) =>
          prev.map((r) =>
            r.id === activeReelForComments.id
              ? { ...r, commentsCount: (r.commentsCount || 0) + 1 }
              : r
          )
        );
      }
    } catch (err) {
      console.log("Error adding reel comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  if (loading && reelsList.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "white", fontSize: 14, marginTop: 12 }}>Loading fresh reels…</Text>
      </View>
    );
  }

  if (!loading && reelsList.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <StatusBar hidden />
        <Ionicons name="film-outline" size={54} color="#6b7280" />
        <Text style={{ color: "white", fontSize: 18, fontWeight: "bold", marginTop: 16 }}>No reels yet</Text>
        <Text style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", marginTop: 8 }}>
          Upload a video reel to see it here!
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden />
      <FlatList
        ref={flatListRef}
        data={reelsList}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ReelItem
            item={item}
            shouldPlay={isTabFocused && activeReelForComments === null && index === activeIndex}
            onLikeToggle={handleLikeToggle}
            onOpenComments={handleOpenComments}
            onShare={handleShare}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ height: SCREEN_HEIGHT, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: "white", fontSize: 14, marginTop: 12 }}>Loading more reels…</Text>
            </View>
          ) : null
        }
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />

      <Modal
        visible={activeReelForComments !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveReelForComments(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ height: SCREEN_HEIGHT * 0.65, backgroundColor: "#18181b", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
            <View style={{ borderBottomColor: "#27272a", borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ width: 30 }} />
              <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                Comments
              </Text>
              <Pressable onPress={() => setActiveReelForComments(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#a1a1aa" />
              </Pressable>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
                {loadingComments ? (
                  <View style={{ paddingVertical: 40, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : commentsList.length > 0 ? (
                  commentsList.map((c: any, index: number) => (
                    <View key={c._id || index} style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                      <Image
                        source={{
                          uri: c.user?.profileImage || "https://i.pravatar.cc/150?img=12",
                        }}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#27272a" }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "white", fontSize: 13, lineHeight: 18 }}>
                          <Text style={{ fontWeight: "600" }}>
                            {c.user?.username || c.user?.name || "User"}
                          </Text>{" "}
                          {c.text}
                        </Text>
                        <Text style={{ color: "#71717a", fontSize: 11, marginTop: 4 }}>
                          {timeAgo(c.createdAt) || "Just now"}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ paddingVertical: 60, alignItems: "center" }}>
                    <Text style={{ color: "#71717a", fontSize: 14 }}>
                      No comments yet. Say something nice!
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View
                style={{
                  borderTopColor: "#27272a",
                  borderTopWidth: 1,
                  backgroundColor: "#18181b",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  gap: 12,
                }}
              >
                <TextInput
                  value={commentInput}
                  onChangeText={setCommentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#71717a"
                  style={{
                    flex: 1,
                    backgroundColor: "#27272a",
                    borderColor: "#3f3f46",
                    borderWidth: 1,
                    color: "white",
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    fontSize: 14,
                  }}
                />
                <Pressable
                  onPress={handleAddComment}
                  disabled={!commentInput.trim() || submittingComment}
                  hitSlop={8}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: commentInput.trim() ? "#38bdf8" : "#52525b",
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      Post
                    </Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
