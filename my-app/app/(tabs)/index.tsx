import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

const initialMockStories = [
  {
    id: "s0",
    username: "your_story",
    image: "https://i.pravatar.cc/150?img=12",
    own: true,
  },
  {
    id: "s1",
    username: "alex",
    image: "https://i.pravatar.cc/150?img=1",
  },
  {
    id: "s2",
    username: "john",
    image: "https://i.pravatar.cc/150?img=3",
  },
  {
    id: "s3",
    username: "sarah",
    image: "https://i.pravatar.cc/150?img=5",
  },
];

const initialMockPosts = [
  {
    id: "p1",
    username: "alex",
    profileImage: "https://i.pravatar.cc/150?img=1",
    postImage: "https://picsum.photos/700/700?random=10",
    likes: 1248,
    isLiked: false,
    caption: "Beautiful day 🌅",
    commentsCount: 2,
    comments: [
      {
        _id: "c1",
        user: { username: "sarah", name: "Sarah", profileImage: "https://i.pravatar.cc/150?img=5" },
        text: "Amazing shot!",
        createdAt: new Date().toISOString(),
      },
      {
        _id: "c2",
        user: { username: "john", name: "John", profileImage: "https://i.pravatar.cc/150?img=3" },
        text: "Love the view! 🔥",
        createdAt: new Date().toISOString(),
      },
    ],
    time: "2 hours ago",
  },
  {
    id: "p2",
    username: "sarah",
    profileImage: "https://i.pravatar.cc/150?img=5",
    postImage: "https://picsum.photos/700/700?random=20",
    likes: 892,
    isLiked: false,
    caption: "Weekend vibes ✨",
    commentsCount: 1,
    comments: [
      {
        _id: "c3",
        user: { username: "alex", name: "Alex", profileImage: "https://i.pravatar.cc/150?img=1" },
        text: "Enjoy your weekend! 🙌",
        createdAt: new Date().toISOString(),
      },
    ],
    time: "5 hours ago",
  },
];

export default function HomeScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Comments Modal State
  const [activePostForComments, setActivePostForComments] = useState<any | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchFeedData = useCallback(async () => {
    try {
      const token = await getToken();
      const [feedData, storiesData] = await Promise.allSettled([
        apiFetch("/feed", {}, token),
        apiFetch("/stories", {}, token),
      ]);

      if (
        feedData.status === "fulfilled" &&
        Array.isArray(feedData.value) &&
        feedData.value.length > 0
      ) {
        const mapped = feedData.value.map((item: any) => ({
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
          time: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "Just now",
        }));
        setPosts(mapped);
      } else {
        setPosts(initialMockPosts);
      }

      if (
        storiesData.status === "fulfilled" &&
        Array.isArray(storiesData.value) &&
        storiesData.value.length > 0
      ) {
        const mappedStories = storiesData.value.map((item: any) => ({
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
            image: user?.imageUrl || "https://i.pravatar.cc/150?img=12",
            own: true,
          },
          ...mappedStories,
        ]);
      } else {
        setStories([
          {
            id: "me",
            username: "Your Story",
            image: user?.imageUrl || "https://i.pravatar.cc/150?img=12",
            own: true,
          },
          ...initialMockStories.slice(1),
        ]);
      }
    } catch (err) {
      console.log("Error loading feed:", err);
      setPosts(initialMockPosts);
      setStories(initialMockStories);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, user]);

  useEffect(() => {
    fetchFeedData();
  }, [fetchFeedData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedData();
  };

  // LIKE TOGGLE HANDLER
  const handleLikeToggle = async (postId: string) => {
    // Optimistic UI update
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
      const res = await apiFetch(`/feed/${postId}/like`, { method: "POST" }, token);
      if (res) {
        setPosts((prevPosts) =>
          prevPosts.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                isLiked: res.isLiked,
                likes: res.likesCount,
              };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.log("Error toggling post like:", err);
    }
  };

  // OPEN COMMENTS MODAL
  const openCommentsModal = async (post: any) => {
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

  // ADD COMMENT HANDLER
  const handleAddComment = async () => {
    if (!commentInput.trim() || !activePostForComments || submittingComment) return;

    const textToSubmit = commentInput.trim();
    setCommentInput("");
    setSubmittingComment(true);

    try {
      const token = await getToken();
      const res = await apiFetch(
        `/feed/${activePostForComments.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ text: textToSubmit }),
        },
        token
      );

      if (res && res.comment) {
        setCommentsList((prev) => [...prev, res.comment]);
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === activePostForComments.id
              ? { ...p, commentsCount: res.commentsCount }
              : p
          )
        );
      } else {
        // Fallback for mock posts
        const mockNewComment = {
          _id: Date.now().toString(),
          user: {
            username: user?.username || user?.firstName || "me",
            profileImage: user?.imageUrl || "https://i.pravatar.cc/150?img=12",
          },
          text: textToSubmit,
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

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-3xl font-bold tracking-tight">Instagram</Text>

        <View className="flex-row items-center gap-5">
          <Pressable onPress={onRefresh}>
            <Ionicons name="reload-outline" size={25} color="black" />
          </Pressable>

          <Pressable>
            <Ionicons name="heart-outline" size={27} color="black" />
          </Pressable>

          <Pressable>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={26}
              color="black"
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* STORIES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-100"
          contentContainerClassName="px-3 py-4 gap-4"
        >
          {stories.map((story) => (
            <Pressable key={story.id} className="items-center">
              <View
                className={`rounded-full p-[2px] ${
                  story.own
                    ? "bg-gray-300"
                    : "bg-gradient-to-r from-pink-500 to-orange-400"
                }`}
              >
                <View className="rounded-full bg-white p-[2px]">
                  <Image
                    source={{ uri: story.image }}
                    className="w-[64px] h-[64px] rounded-full"
                  />
                </View>
              </View>

              <Text
                numberOfLines={1}
                className="text-xs mt-1 w-[70px] text-center"
              >
                {story.username}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#000" />
            <Text className="mt-2 text-gray-500">Loading feed...</Text>
          </View>
        ) : (
          /* POSTS */
          posts.map((post) => (
            <View
              key={post.id}
              className="border-b border-gray-200 pb-5"
            >
              {/* POST HEADER */}
              <View className="flex-row items-center justify-between px-4 py-3">
                <Pressable
                  onPress={() => router.push(`/user/${post.username}`)}
                  className="flex-row items-center"
                >
                  <Image
                    source={{ uri: post.profileImage }}
                    className="w-9 h-9 rounded-full mr-3 bg-gray-200"
                  />

                  <View>
                    <Text className="font-semibold text-sm">
                      {post.username}
                    </Text>
                    <Text className="text-xs text-gray-500">India</Text>
                  </View>
                </Pressable>

                <Pressable>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color="black"
                  />
                </Pressable>
              </View>

              {/* POST IMAGE */}
              <Pressable onDoubleClick={() => handleLikeToggle(post.id)}>
                <Image
                  source={{ uri: post.postImage }}
                  className="w-full aspect-square bg-gray-100"
                  resizeMode="cover"
                />
              </Pressable>

              {/* ACTION BUTTONS */}
              <View className="flex-row items-center justify-between px-4 pt-3">
                <View className="flex-row items-center gap-5">
                  <Pressable onPress={() => handleLikeToggle(post.id)}>
                    <Ionicons
                      name={post.isLiked ? "heart" : "heart-outline"}
                      size={28}
                      color={post.isLiked ? "#ef4444" : "black"}
                    />
                  </Pressable>

                  <Pressable onPress={() => openCommentsModal(post)}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={27}
                      color="black"
                    />
                  </Pressable>

                  <Pressable>
                    <Ionicons
                      name="paper-plane-outline"
                      size={27}
                      color="black"
                    />
                  </Pressable>
                </View>

                <Pressable>
                  <Ionicons name="bookmark-outline" size={27} color="black" />
                </Pressable>
              </View>

              {/* LIKES */}
              <Text className="font-semibold text-sm px-4 mt-2">
                {post.likes.toLocaleString()} likes
              </Text>

              {/* CAPTION */}
              {post.caption ? (
                <View className="flex-row px-4 mt-1">
                  <Text className="font-semibold mr-1">{post.username}</Text>
                  <Text className="text-sm">{post.caption}</Text>
                </View>
              ) : null}

              {/* COMMENTS COUNT / TRIGGER */}
              <Pressable
                onPress={() => openCommentsModal(post)}
                className="px-4 mt-2"
              >
                <Text className="text-gray-500 text-sm">
                  {post.commentsCount > 0
                    ? `View all ${post.commentsCount} comments`
                    : "Add a comment..."}
                </Text>
              </Pressable>

              {/* TIME */}
              <Text className="text-gray-400 text-[10px] uppercase px-4 mt-3">
                {post.time}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* COMMENTS MODAL */}
      <Modal
        visible={!!activePostForComments}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActivePostForComments(null)}
      >
        <SafeAreaView className="flex-1 bg-white">
          {/* MODAL HEADER */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
            <Pressable
              onPress={() => setActivePostForComments(null)}
              className="p-1"
            >
              <Ionicons name="close" size={26} color="black" />
            </Pressable>
            <Text className="font-bold text-lg">Comments</Text>
            <View className="w-6" />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            {/* COMMENTS LIST */}
            <ScrollView className="flex-1 px-4 py-3">
              {loadingComments ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color="#000" />
                  <Text className="text-gray-500 text-xs mt-2">
                    Loading comments...
                  </Text>
                </View>
              ) : commentsList.length > 0 ? (
                commentsList.map((c: any, index: number) => (
                  <View
                    key={c._id || index}
                    className="flex-row items-start mb-4"
                  >
                    <Image
                      source={{
                        uri:
                          c.user?.profileImage ||
                          "https://i.pravatar.cc/150?img=12",
                      }}
                      className="w-9 h-9 rounded-full mr-3 bg-gray-200"
                    />
                    <View className="flex-1">
                      <Text className="text-sm">
                        <Text className="font-bold">
                          {c.user?.username || c.user?.name || "user"}{" "}
                        </Text>
                        <Text className="text-gray-800">{c.text}</Text>
                      </Text>
                      <Text className="text-gray-400 text-[10px] mt-1">
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View className="py-16 items-center">
                  <Ionicons
                    name="chatbubble-outline"
                    size={40}
                    color="#9ca3af"
                  />
                  <Text className="text-gray-500 font-semibold mt-2">
                    No comments yet
                  </Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    Start the conversation!
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* INPUT BAR */}
            <View className="flex-row items-center px-4 py-3 border-t border-gray-200 bg-white">
              <Image
                source={{
                  uri: user?.imageUrl || "https://i.pravatar.cc/150?img=12",
                }}
                className="w-9 h-9 rounded-full mr-3 bg-gray-200"
              />
              <TextInput
                placeholder="Add a comment..."
                placeholderTextColor="#9ca3af"
                value={commentInput}
                onChangeText={setCommentInput}
                className="flex-1 text-sm text-black py-2"
                onSubmitEditing={handleAddComment}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleAddComment}
                disabled={!commentInput.trim() || submittingComment}
                className="ml-2 px-3 py-1.5 rounded-lg"
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Text
                    className={`font-bold text-sm ${
                      commentInput.trim() ? "text-blue-500" : "text-blue-200"
                    }`}
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