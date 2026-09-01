import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const posts = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  image: `https://picsum.photos/400/400?random=${i + 100}`,
}));

export default function Profile() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-bold">
            @yourusername
          </Text>

          <View className="flex-row items-center gap-5">
            <Pressable>
              <Ionicons
                name="add-outline"
                size={28}
                color="black"
              />
            </Pressable>

            <Pressable>
              <Ionicons
                name="menu-outline"
                size={29}
                color="black"
              />
            </Pressable>
          </View>
        </View>

        {/* PROFILE INFO */}
        <View className="px-4 pt-4">

          <View className="flex-row items-center">

            {/* PROFILE IMAGE */}
            <Image
              source={{
                uri: "https://i.pravatar.cc/300?img=12",
              }}
              className="w-24 h-24 rounded-full"
            />

            {/* STATS */}
            <View className="flex-1 flex-row justify-around ml-5">
              <View className="items-center">
                <Text className="font-bold text-lg">
                  18
                </Text>
                <Text className="text-sm">
                  Posts
                </Text>
              </View>

              <View className="items-center">
                <Text className="font-bold text-lg">
                  1.2K
                </Text>
                <Text className="text-sm">
                  Followers
                </Text>
              </View>

              <View className="items-center">
                <Text className="font-bold text-lg">
                  384
                </Text>
                <Text className="text-sm">
                  Following
                </Text>
              </View>
            </View>

          </View>

          {/* BIO */}
          <View className="mt-4">
            <Text className="font-bold">
              Your Name
            </Text>

            <Text className="text-sm mt-1">
              Building something cool 🚀
            </Text>

            <Text className="text-sm">
              Developer • AI enthusiast
            </Text>

            <Text className="text-blue-600 text-sm mt-1">
              yourwebsite.com
            </Text>
          </View>

          {/* BUTTONS */}
          <View className="flex-row gap-2 mt-4">

            <Pressable className="flex-1 bg-gray-100 rounded-lg py-2.5 items-center">
              <Text className="font-semibold">
                Edit profile
              </Text>
            </Pressable>

            <Pressable className="flex-1 bg-gray-100 rounded-lg py-2.5 items-center">
              <Text className="font-semibold">
                Share profile
              </Text>
            </Pressable>

          </View>

        </View>

        {/* HIGHLIGHTS */}
        <View className="mt-5 px-4">
          <Text className="font-bold mb-3">
            Story Highlights
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {["Travel", "Work", "AI", "Friends", "Life"].map(
              (highlight, index) => (
                <Pressable
                  key={highlight}
                  className="items-center mr-5"
                >
                  <View className="w-16 h-16 rounded-full border border-gray-300 p-1">
                    <Image
                      source={{
                        uri: `https://picsum.photos/200/200?random=${
                          index + 200
                        }`,
                      }}
                      className="w-full h-full rounded-full"
                    />
                  </View>

                  <Text className="text-xs mt-1">
                    {highlight}
                  </Text>
                </Pressable>
              )
            )}
          </ScrollView>
        </View>

        {/* POSTS / REELS / TAGGED */}
        <View className="flex-row border-t border-gray-200 mt-5">

          <Pressable className="flex-1 items-center py-3 border-b-2 border-black">
            <Ionicons
              name="grid-outline"
              size={23}
              color="black"
            />
          </Pressable>

          <Pressable className="flex-1 items-center py-3">
            <Ionicons
              name="play-outline"
              size={24}
              color="gray"
            />
          </Pressable>

          <Pressable className="flex-1 items-center py-3">
            <Ionicons
              name="person-outline"
              size={23}
              color="gray"
            />
          </Pressable>

        </View>

        {/* POST GRID */}
        <View className="flex-row flex-wrap">
          {posts.map((post) => (
            <Pressable
              key={post.id}
              className="w-1/3 aspect-square p-[1px]"
            >
              <Image
                source={{ uri: post.image }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}