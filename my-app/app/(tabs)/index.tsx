import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const stories = [
  {
    username: "your_story",
    image: "https://i.pravatar.cc/150?img=12",
    own: true,
  },
  {
    username: "alex",
    image: "https://i.pravatar.cc/150?img=1",
  },
  {
    username: "john",
    image: "https://i.pravatar.cc/150?img=3",
  },
  {
    username: "sarah",
    image: "https://i.pravatar.cc/150?img=5",
  },
  {
    username: "mike",
    image: "https://i.pravatar.cc/150?img=7",
  },
  {
    username: "emma",
    image: "https://i.pravatar.cc/150?img=9",
  },
];

const posts = [
  {
    username: "alex",
    profileImage: "https://i.pravatar.cc/150?img=1",
    postImage: "https://picsum.photos/700/700?random=10",
    likes: 1248,
    caption: "Beautiful day 🌅",
    comments: 42,
    time: "2 hours ago",
  },
  {
    username: "sarah",
    profileImage: "https://i.pravatar.cc/150?img=5",
    postImage: "https://picsum.photos/700/700?random=20",
    likes: 892,
    caption: "Weekend vibes ✨",
    comments: 31,
    time: "5 hours ago",
  },
  {
    username: "john",
    profileImage: "https://i.pravatar.cc/150?img=3",
    postImage: "https://picsum.photos/700/700?random=30",
    likes: 2314,
    caption: "Exploring somewhere new.",
    comments: 87,
    time: "1 day ago",
  },
];

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      
      {/* HEADER */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-3xl font-bold tracking-tight">
          Instagram
        </Text>

        <View className="flex-row items-center gap-5">
          <Pressable>
            <Ionicons
              name="heart-outline"
              size={27}
              color="black"
            />
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
      >

        {/* STORIES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-100"
          contentContainerClassName="px-3 py-4 gap-4"
        >
          {stories.map((story) => (
            <Pressable
              key={story.username}
              className="items-center"
            >
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

        {/* POSTS */}
        {posts.map((post) => (
          <View
            key={post.username}
            className="border-b border-gray-200 pb-5"
          >

            {/* POST HEADER */}
            <View className="flex-row items-center justify-between px-4 py-3">
              <View className="flex-row items-center">
                <Image
                  source={{ uri: post.profileImage }}
                  className="w-9 h-9 rounded-full mr-3"
                />

                <View>
                  <Text className="font-semibold text-sm">
                    {post.username}
                  </Text>

                  <Text className="text-xs text-gray-500">
                    India
                  </Text>
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
              className="w-full aspect-square"
              resizeMode="cover"
            />

            {/* ACTION BUTTONS */}
            <View className="flex-row items-center justify-between px-4 pt-3">
              <View className="flex-row items-center gap-5">

                <Pressable>
                  <Ionicons
                    name="heart-outline"
                    size={28}
                    color="black"
                  />
                </Pressable>

                <Pressable>
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
                <Ionicons
                  name="bookmark-outline"
                  size={27}
                  color="black"
                />
              </Pressable>
            </View>

            {/* LIKES */}
            <Text className="font-semibold text-sm px-4 mt-2">
              {post.likes.toLocaleString()} likes
            </Text>

            {/* CAPTION */}
            <View className="flex-row px-4 mt-1">
              <Text className="font-semibold mr-1">
                {post.username}
              </Text>

              <Text className="text-sm">
                {post.caption}
              </Text>
            </View>

            {/* COMMENTS */}
            <Pressable className="px-4 mt-2">
              <Text className="text-gray-500 text-sm">
                View all {post.comments} comments
              </Text>
            </Pressable>

            {/* ADD COMMENT */}
            <View className="flex-row items-center px-4 mt-3">
              <Image
                source={{
                  uri: "https://i.pravatar.cc/150?img=12",
                }}
                className="w-7 h-7 rounded-full mr-2"
              />

              <Text className="text-gray-400 text-sm">
                Add a comment...
              </Text>
            </View>

            {/* TIME */}
            <Text className="text-gray-400 text-[10px] uppercase px-4 mt-3">
              {post.time}
            </Text>

          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}