import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { apiFetch } from "@/lib/api";

const initialUsers = [
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

export default function Search() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(
    async (q: string) => {
      try {
        setLoading(true);
        const token = await getToken();
        const results = await apiFetch(`/search?q=${encodeURIComponent(q)}`, {}, token);
        if (Array.isArray(results)) {
          setSearchResults(
            results.map((u) => ({
              username: u.username,
              name: u.name,
              image: u.profileImage || `https://i.pravatar.cc/150?u=${u.username}`,
            }))
          );
        }
      } catch (err) {
        console.log("Search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch(query.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const displayUsers = query.trim() ? searchResults : initialUsers;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER / SEARCH BAR */}
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 h-11">
          <Ionicons name="search" size={20} color="#737373" />

          <TextInput
            placeholder="Search users..."
            placeholderTextColor="#737373"
            value={query}
            onChangeText={setQuery}
            className="flex-1 ml-2 text-base text-black"
          />

          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={20} color="#737373" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* SUGGESTED / SEARCH USERS */}
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-bold">
              {query.trim() ? "Search Results" : "Suggested for you"}
            </Text>

            {loading ? <ActivityIndicator size="small" color="#000" /> : null}
          </View>

          {displayUsers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {displayUsers.map((user) => (
                <Pressable
                  key={user.username}
                  className="items-center mr-5"
                >
                  <Image
                    source={{ uri: user.image }}
                    className="w-20 h-20 rounded-full bg-gray-200"
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
          ) : (
            <Text className="text-gray-500 py-4 text-center">
              No users found matching "{query}"
            </Text>
          )}
        </View>

        {/* EXPLORE SECTION */}
        <View className="border-t border-gray-200 pt-1">
          <Text className="font-bold text-base px-4 py-3">Explore</Text>

          <View className="flex-row flex-wrap">
            {Array.from({ length: 12 }, (_, i) => ({
              id: i,
              image: `https://picsum.photos/400/400?random=${i + 50}`,
            })).map((post) => (
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