import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const users = [
  {
    username: "alex",
    name: "Alex Johnson",
    image: "https://i.pravatar.cc/150?img=1",
  },
  {
    username: "sarah",
    name: "Sarah Smith",
    image: "https://i.pravatar.cc/150?img=5",
  },
  {
    username: "john",
    name: "John Doe",
    image: "https://i.pravatar.cc/150?img=3",
  },
];

const posts = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  image: `https://picsum.photos/400/400?random=${i + 50}`,
}));

export default function Search() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER / SEARCH BAR */}
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 h-11">
          <Ionicons
            name="search"
            size={20}
            color="#737373"
          />

          <TextInput
            placeholder="Search"
            placeholderTextColor="#737373"
            className="flex-1 ml-2 text-base text-black"
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* SUGGESTED USERS */}
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-bold">
              Suggested for you
            </Text>

            <Pressable>
              <Text className="text-blue-500 font-semibold">
                See all
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {users.map((user) => (
              <Pressable
                key={user.username}
                className="items-center mr-5"
              >
                <Image
                  source={{ uri: user.image }}
                  className="w-20 h-20 rounded-full"
                />

                <Text className="font-semibold text-sm mt-2">
                  {user.username}
                </Text>

                <Text className="text-gray-500 text-xs mt-1">
                  {user.name}
                </Text>

                <View className="bg-black rounded-lg px-5 py-2 mt-2">
                  <Text className="text-white font-semibold text-xs">
                    Follow
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* EXPLORE GRID */}
        <View className="border-t border-gray-200 pt-1">
          <Text className="font-bold text-base px-4 py-3">
            Explore
          </Text>

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}