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
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

const initialUsersList = [
  {
    username: "alex",
    name: "Alex Johnson",
    image: "https://i.pravatar.cc/150?img=1",
    isFollowing: false,
    followersCount: 120,
  },
  {
    username: "sarah",
    name: "Sarah Smith",
    image: "https://i.pravatar.cc/150?img=5",
    isFollowing: false,
    followersCount: 240,
  },
  {
    username: "john",
    name: "John Doe",
    image: "https://i.pravatar.cc/150?img=3",
    isFollowing: false,
    followersCount: 95,
  },
];

export default function Search() {
  const { getToken } = useAuth();
  const { user: me } = useUser();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>(initialUsersList);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const currentUsername = me?.username || me?.firstName || "";

  // Filter suggested users to exclude current user
  useEffect(() => {
    if (currentUsername) {
      setSuggestedUsers(
        initialUsersList.filter(
          (u) => u.username.toLowerCase() !== currentUsername.toLowerCase()
        )
      );
    }
  }, [currentUsername]);

  const handleSearch = async (q: string) => {
    setQuery(q);

    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);

      const token = await getToken();

      const results = await apiFetch(
        `/search?q=${encodeURIComponent(q.trim())}`,
        {},
        token
      );

      if (Array.isArray(results)) {
        // Exclude current logged in user
        const filtered = results.filter(
          (u: any) =>
            u.username?.toLowerCase() !== currentUsername.toLowerCase()
        );

        setSearchResults(
          filtered.map((u) => ({
            id: u._id,
            username: u.username,
            name: u.name,
            image:
              u.profileImage || `https://i.pravatar.cc/150?u=${u.username}`,
            isFollowing: u.isFollowing || false,
            followersCount: u.followersCount || 0,
          }))
        );
      }
    } catch (err) {
      console.log("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUsername: string) => {
    if (followingMap[targetUsername]) return;

    try {
      setFollowingMap((prev) => ({ ...prev, [targetUsername]: true }));
      const token = await getToken();
      const res = await apiFetch(
        `/profile/${targetUsername}/follow`,
        { method: "POST" },
        token
      );

      const updateList = (list: any[]) =>
        list.map((u) =>
          u.username === targetUsername
            ? {
                ...u,
                isFollowing: res.isFollowing,
                followersCount: res.followersCount,
              }
            : u
        );

      setSearchResults((prev) => updateList(prev));
      setSuggestedUsers((prev) => updateList(prev));
    } catch (err) {
      console.log("Error toggling follow from search:", err);
    } finally {
      setFollowingMap((prev) => ({ ...prev, [targetUsername]: false }));
    }
  };

  const displayUsers = query.trim() ? searchResults : suggestedUsers;

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
            onChangeText={handleSearch}
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
                <View key={user.username} className="items-center mr-5">
                  <Pressable
                    onPress={() => router.push(`/user/${user.username}`)}
                    className="items-center"
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
                  </Pressable>

                  <Pressable
                    onPress={() => handleFollowToggle(user.username)}
                    disabled={followingMap[user.username]}
                    className={`rounded-lg px-5 py-2 mt-2 ${
                      user.isFollowing
                        ? "bg-gray-200 border border-gray-300"
                        : "bg-black"
                    }`}
                  >
                    {followingMap[user.username] ? (
                      <ActivityIndicator
                        size="small"
                        color={user.isFollowing ? "#000" : "#fff"}
                      />
                    ) : (
                      <Text
                        className={`font-semibold text-xs ${
                          user.isFollowing ? "text-black" : "text-white"
                        }`}
                      >
                        {user.isFollowing ? "Following" : "Follow"}
                      </Text>
                    )}
                  </Pressable>
                </View>
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
              <Pressable key={post.id} className="w-1/3 aspect-square p-[1px]">
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
