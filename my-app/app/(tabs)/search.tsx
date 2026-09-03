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
import { useTheme } from "@/context/ThemeContext";

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
  const { colors, isDark } = useTheme();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>(initialUsersList);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const currentUsername = me?.username || me?.firstName || "";

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
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      {/* HEADER / SEARCH BAR */}
      <View className="px-4 pt-2 pb-3">
        <View
          style={{ backgroundColor: colors.inputBg }}
          className="flex-row items-center rounded-xl px-3 h-11 border border-transparent dark:border-gray-800"
        >
          <Ionicons name="search" size={20} color={colors.subtext} />

          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search users..."
            placeholderTextColor={colors.subtext}
            style={{ color: colors.text }}
            className="flex-1 ml-2.5 text-base"
            autoCapitalize="none"
          />

          {query.length > 0 && (
            <Pressable onPress={() => handleSearch("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.subtext}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* BODY */}
      <ScrollView className="flex-1 px-4">
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.subtext }} className="mt-3 text-sm">
              Searching...
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={{ color: colors.subtext }}
              className="font-bold text-xs uppercase tracking-wider mb-3 mt-2"
            >
              {query.trim() ? "Search Results" : "Suggested for you"}
            </Text>

            {displayUsers.length > 0 ? (
              displayUsers.map((user) => (
                <Pressable
                  key={user.username}
                  onPress={() => router.push(`/user/${user.username}`)}
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                    <Image
                      source={{ uri: user.image }}
                      className="w-12 h-12 rounded-full bg-gray-200"
                    />

                    <View className="flex-1">
                      <Text
                        style={{ color: colors.text }}
                        className="font-bold text-base"
                      >
                        {user.username}
                      </Text>
                      <Text
                        style={{ color: colors.subtext }}
                        className="text-xs"
                      >
                        {user.name}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleFollowToggle(user.username)}
                    disabled={followingMap[user.username]}
                    style={{
                      backgroundColor: user.isFollowing
                        ? colors.inputBg
                        : "#3B82F6",
                      borderColor: colors.border,
                    }}
                    className={`px-4 py-1.5 rounded-lg border border-transparent`}
                  >
                    <Text
                      style={{
                        color: user.isFollowing ? colors.text : "#FFFFFF",
                      }}
                      className="font-semibold text-xs"
                    >
                      {user.isFollowing ? "Following" : "Follow"}
                    </Text>
                  </Pressable>
                </Pressable>
              ))
            ) : (
              <View className="py-16 items-center">
                <Ionicons
                  name="person-remove-outline"
                  size={48}
                  color={colors.subtext}
                />
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-base mt-3"
                >
                  No users found
                </Text>
                <Text
                  style={{ color: colors.subtext }}
                  className="text-xs mt-1 text-center"
                >
                  Try searching for another username or name.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
