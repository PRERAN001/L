import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useFeedTracker } from "@/hooks/useFeedTracker";
import { StoryRing } from "@/components/StoryRing";
import { FeedPost } from "@/components/FeedPost";
import { timeAgo } from "@/lib/timeAgo";

export default function HomeScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { colors } = useTheme();

  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const [activePostForComments, setActivePostForComments] = useState<any | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const { onPostViewable, onPostHidden, recordEngagement, resetTracking } =
    useFeedTracker();

  const postLayouts = useRef<Record<string, { y: number; height: number }>>({});
  const getTokenRef = useRef(getToken);
  const userRef = useRef(user);
  getTokenRef.current = getToken;
  userRef.current = user;

  const fetchFeedData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const token = await getTokenRef.current();
      const [feedData, storiesData] = await Promise.allSettled([
        apiFetch("/feed", {}, token),
        apiFetch("/stories", {}, token),
      ]);

      if (feedData.status === "fulfilled" && feedData.value) {
        const response = feedData.value;
        const fetchedPosts = Array.isArray(response)
          ? response
          : Array.isArray(response.posts)
          ? response.posts
          : [];

        if (fetchedPosts.length > 0) {
          const photosOnly = fetchedPosts.filter(
            (item: any) => item.mediaType !== "video"
          );

          const mapped = photosOnly.map((item: any) => ({
            id: item._id || item.id,
            username: item.user?.username || item.user?.name || "user",
            profileImage:
              item.user?.profileImage || "https://i.pravatar.cc/150?img=12",
            postImage: item.mediaUrl,
            likes: item.likesCount ?? item.likes?.length ?? 0,
            isLiked: item.isLiked || false,
            caption: item.caption || "",
            commentsCount: item.commentsCount ?? item.comments?.length ?? 0,
            comments: item.comments || [],
            createdAt: item.createdAt || null,
            time: item.createdAt
              ? new Date(item.createdAt).toLocaleDateString()
              : "Just now",
          }));
          setPosts(mapped);
          resetTracking();
          postLayouts.current = {};
          setNextCursor(response.nextCursor || "20");
          setHasMore(response.hasMore ?? true);
        } else {
          setPosts([]);
          resetTracking();
          postLayouts.current = {};
          setNextCursor(null);
          setHasMore(false);
        }
      } else {
        setNextCursor(null);
        setHasMore(false);
      }

      const responseStories =
        storiesData.status === "fulfilled"
          ? Array.isArray(storiesData.value)
          ? storiesData.value
          : Array.isArray(storiesData.value?.stories)
          ? storiesData.value.stories
          : []
          : [];

      const mappedStories = responseStories.map((item: any) => ({
        id: item._id || item.id,
        username: item.user?.username || "user",
        image:
          item.user?.profileImage ||
          item.mediaUrl ||
          "https://i.pravatar.cc/150?img=12",
        own: false,
      }));

      setStories([
        {
          id: "me",
          username: "Your Story",
          image: userRef.current?.imageUrl || "https://i.pravatar.cc/150?img=12",
          own: true,
        },
        ...mappedStories,
      ]);
    } catch (err) {
      console.log("Error loading feed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resetTracking]);

  const fetchMorePosts = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const token = await getTokenRef.current();
      const res = await apiFetch(
        `/feed?cursor=${encodeURIComponent(nextCursor)}`,
        {},
        token
      );

      if (res) {
        const fetchedPosts = Array.isArray(res)
          ? res
          : Array.isArray(res.posts)
          ? res.posts
          : [];

        if (fetchedPosts.length > 0) {
          const photosOnly = fetchedPosts.filter(
            (item: any) => item.mediaType !== "video"
          );

          const mappedNew = photosOnly.map((item: any) => ({
            id: item._id || item.id,
            username: item.user?.username || item.user?.name || "user",
            profileImage:
              item.user?.profileImage || "https://i.pravatar.cc/150?img=12",
            postImage: item.mediaUrl,
            likes: item.likesCount ?? item.likes?.length ?? 0,
            isLiked: item.isLiked || false,
            caption: item.caption || "",
            commentsCount: item.commentsCount ?? item.comments?.length ?? 0,
            comments: item.comments || [],
            createdAt: item.createdAt || null,
            time: item.createdAt
              ? new Date(item.createdAt).toLocaleDateString()
              : "Just now",
          }));

          setPosts((prevPosts) => {
            const existingIds = new Set(prevPosts.map((p: any) => p.id));
            const uniqueNew = mappedNew.filter((p: any) => !existingIds.has(p.id));
            return [...prevPosts, ...uniqueNew];
          });

          setNextCursor(res.nextCursor || String(posts.length + mappedNew.length));
          setHasMore(res.hasMore ?? true);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.log("Error loading more feed posts:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, hasMore, loadingMore, posts.length]);

  useFocusEffect(
    useCallback(() => {
      fetchFeedData(posts.length === 0);
    }, [fetchFeedData, posts.length])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedData(false);
  };

  const handleLikeToggle = async (postId: string) => {
    recordEngagement(postId, "like");

    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id === postId) {
          const newIsLiked = !p.isLiked;
          return {
            ...p,
            isLiked: newIsLiked,
            likes: newIsLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
          };
        }
        return p;
      })
    );

    try {
      const token = await getToken();
      await apiFetch(`/feed/${postId}/like`, { method: "POST" }, token);
    } catch (err) {
      console.log("Error toggling like:", err);
    }
  };

  const handleOpenComments = async (post: any) => {
    setActivePostForComments(post);
    setCommentsList(post.comments || []);
    setLoadingComments(true);

    try {
      const token = await getToken();
      const res = await apiFetch(`/feed/${post.id}/comments`, {}, token);
      if (res && Array.isArray(res.comments)) {
        setCommentsList(res.comments);
      }
    } catch (err) {
      console.log("Error fetching comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim() || !activePostForComments) return;

    recordEngagement(activePostForComments.id, "comment");

    const textToSend = commentInput.trim();
    setCommentInput("");

    try {
      setSubmittingComment(true);
      const token = await getToken();
      const res = await apiFetch(
        `/feed/${activePostForComments.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ text: textToSend }),
        },
        token
      );

      if (res && res.comment) {
        setCommentsList((prev) => [...prev, res.comment]);
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === activePostForComments.id
              ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
              : p
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
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === activePostForComments.id
              ? { ...p, commentsCount: p.commentsCount + 1 }
              : p
          )
        );
      }
    } catch (err) {
      console.log("Error adding comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderStoriesHeader = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ borderBottomColor: colors.border }}
      className="border-b"
      contentContainerClassName="px-3 py-3 gap-1"
    >
      {stories.map((story) => (
        <Pressable
          key={story.id}
          className="items-center"
          style={{ width: 74 }}
        >
          <StoryRing
            image={story.image}
            own={story.own}
            colors={colors}
          />
          <Text
            numberOfLines={1}
            style={{ color: colors.text }}
            className="text-[11px] mt-1 w-[68px] text-center"
          >
            {story.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <View
        style={{ borderBottomColor: colors.border }}
        className="flex-row items-center justify-between px-4 py-2 border-b"
      >
        <Text
          style={{ color: colors.text, fontFamily: "GrandHotel", lineHeight: 42 }}
          className="text-[30px]"
        >
          Instagram
        </Text>

        <View className="flex-row items-center gap-5">
          <Pressable hitSlop={8}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
          </Pressable>

          <Pressable hitSlop={8}>
            <Ionicons
              name="paper-plane-outline"
              size={25}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="py-20 items-center justify-center flex-1">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.subtext }} className="mt-2 text-sm">
            Loading feed...
          </Text>
        </View>
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedPost
              post={item}
              colors={colors}
              onLayout={(e: LayoutChangeEvent) => {
                postLayouts.current[item.id] = {
                  y: e.nativeEvent.layout.y,
                  height: e.nativeEvent.layout.height,
                };
              }}
              onLike={handleLikeToggle}
              onOpenComments={handleOpenComments}
              onOpenProfile={(username) => router.push(`/user/${username}`)}
            />
          )}
          ListHeaderComponent={renderStoriesHeader}
          onEndReached={fetchMorePosts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <View className="py-8" />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
        >
          {renderStoriesHeader()}
          <View className="py-20 items-center justify-center px-4">
            <View
              style={{ borderColor: colors.text }}
              className="w-16 h-16 rounded-full border-2 items-center justify-center mb-3"
            >
              <Ionicons name="camera-outline" size={32} color={colors.text} />
            </View>
            <Text style={{ color: colors.text }} className="mt-1 font-bold text-lg">
              No Posts Yet
            </Text>
            <Text style={{ color: colors.subtext }} className="mt-1 text-sm text-center">
              Share a post or follow others to see photos here.
            </Text>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={activePostForComments !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActivePostForComments(null)}
      >
        <SafeAreaView
          style={{ backgroundColor: colors.modalBg }}
          className="flex-1"
        >
          <View
            style={{ borderBottomColor: colors.border }}
            className="flex-row items-center justify-between px-4 py-3 border-b"
          >
            <Pressable
              onPress={() => setActivePostForComments(null)}
              className="p-1"
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text }} className="font-semibold text-base">
              Comments
            </Text>
            <View className="w-6" />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <ScrollView className="flex-1 px-4 py-3">
              {loadingComments ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : commentsList.length > 0 ? (
                commentsList.map((c: any, index: number) => (
                  <View key={c._id || index} className="flex-row gap-3 mb-4">
                    <Image
                      source={{
                        uri:
                          c.user?.profileImage ||
                          "https://i.pravatar.cc/150?img=12",
                      }}
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: colors.card }}
                    />
                    <View className="flex-1">
                      <Text
                        style={{ color: colors.text }}
                        className="text-[13px] leading-[18px]"
                      >
                        <Text className="font-semibold">
                          {c.user?.username || c.user?.name || "User"}
                        </Text>{" "}
                        {c.text}
                      </Text>
                      <Text
                        style={{ color: colors.subtext }}
                        className="text-[11px] mt-1"
                      >
                        {timeAgo(c.createdAt) || "Just now"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View className="py-16 items-center">
                  <Text style={{ color: colors.subtext }} className="text-sm">
                    No comments yet. Start the conversation!
                  </Text>
                </View>
              )}
            </ScrollView>

            <View
              style={{
                borderTopColor: colors.border,
                backgroundColor: colors.modalBg,
              }}
              className="flex-row items-center px-4 py-3 border-t gap-3"
            >
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.subtext}
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                }}
                className="flex-1 px-4 py-2.5 rounded-full border text-sm"
              />
              <Pressable
                onPress={handleAddComment}
                disabled={!commentInput.trim() || submittingComment}
                hitSlop={6}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={{
                      color: commentInput.trim() ? colors.accent : colors.subtext,
                    }}
                    className="font-semibold text-sm"
                  >
                    Post
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
