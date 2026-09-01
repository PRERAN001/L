import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
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
    caption: "Beautiful day 🌅",
    comments: 42,
    time: "2 hours ago",
  },
  {
    id: "p2",
    username: "sarah",
    profileImage: "https://i.pravatar.cc/150?img=5",
    postImage: "https://picsum.photos/700/700?random=20",
    likes: 892,
    caption: "Weekend vibes ✨",
    comments: 31,
    time: "5 hours ago",
  },
];

export default function HomeScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeedData = useCallback(async () => {
    try {
      const token = await getToken();
      const [feedData, storiesData] = await Promise.allSettled([
        apiFetch("/feed", {}, token),
        apiFetch("/stories", {}, token),
      ]);

      if (feedData.status === "fulfilled" && Array.isArray(feedData.value) && feedData.value.length > 0) {
        const mapped = feedData.value.map((item: any) => ({
          id: item._id || item.id,
          username: item.user?.username || item.user?.name || "user",
          profileImage: item.user?.profileImage || "https://i.pravatar.cc/150?img=12",
          postImage: item.mediaUrl,
          likes: item.likes?.length || 0,
          caption: item.caption || "",
          comments: item.comments?.length || 0,
          time: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Just now",
        }));
        setPosts(mapped);
      } else {
        setPosts(initialMockPosts);
      }

      if (storiesData.status === "fulfilled" && Array.isArray(storiesData.value) && storiesData.value.length > 0) {
        const mappedStories = storiesData.value.map((item: any) => ({
          id: item._id || item.id,
          username: item.user?.username || "user",
          image: item.user?.profileImage || item.mediaUrl || "https://i.pravatar.cc/150?img=12",
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
                <View className="flex-row items-center">
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
                </View>

                <Pressable>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color="black"
                  />
                </Pressable>
              </View>

              {/* POST IMAGE */}
              <Image
                source={{ uri: post.postImage }}
                className="w-full aspect-square bg-gray-100"
                resizeMode="cover"
              />

              {/* ACTION BUTTONS */}
              <View className="flex-row items-center justify-between px-4 pt-3">
                <View className="flex-row items-center gap-5">
                  <Pressable>
                    <Ionicons name="heart-outline" size={28} color="black" />
                  </Pressable>

                  <Pressable>
                    <Ionicons name="chatbubble-outline" size={27} color="black" />
                  </Pressable>

                  <Pressable>
                    <Ionicons name="paper-plane-outline" size={27} color="black" />
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

              {/* COMMENTS */}
              <Pressable className="px-4 mt-2">
                <Text className="text-gray-500 text-sm">
                  View all {post.comments} comments
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
    </SafeAreaView>
  );
}