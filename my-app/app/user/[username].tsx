import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

interface UserProfile {
  _id: string;
  clerkId: string;
  username: string;
  name: string;
  bio: string;
  profileImage: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isBlocked?: boolean;
}

interface UserPost {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  likesCount: number;
  createdAt: string;
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { user: me } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [blockingLoading, setBlockingLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);

  const fetchUserProfile = useCallback(async () => {
    if (!username) return;
    try {
      const token = await getToken();
      const data = await apiFetch(`/profile/${username}`, {}, token);

      if (data && data.user) {
        setProfile(data.user);
      }
      if (data && data.posts) {
        setPosts(data.posts);
      }
    } catch (err: any) {
      console.log("Error loading user profile:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username, getToken]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserProfile();
  };

  const handleFollowToggle = async () => {
    if (!profile || followingLoading || profile.isBlocked) return;
    try {
      setFollowingLoading(true);
      const token = await getToken();
      const res = await apiFetch(
        `/profile/${profile.username}/follow`,
        { method: "POST" },
        token
      );

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: res.isFollowing,
              followersCount: res.followersCount,
              followingCount: res.followingCount ?? prev.followingCount,
            }
          : null
      );
    } catch (err: any) {
      console.log("Error toggling follow:", err);
    } finally {
      setFollowingLoading(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!profile || blockingLoading) return;
    try {
      setBlockingLoading(true);
      const token = await getToken();
      const res = await apiFetch(
        `/profile/${profile.username}/block`,
        { method: "POST" },
        token
      );

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isBlocked: res.isBlocked,
              isFollowing: res.isFollowing,
              followersCount: res.followersCount,
              followingCount: res.followingCount ?? prev.followingCount,
            }
          : null
      );

      if (res.isBlocked) {
        setPosts([]);
      } else {
        fetchUserProfile();
      }
    } catch (err: any) {
      console.log("Error toggling block:", err);
    } finally {
      setBlockingLoading(false);
    }
  };

  const isOwnProfile =
    me?.username === username || me?.firstName === username;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-1 -ml-1">
          <Ionicons name="chevron-back" size={28} color="black" />
        </Pressable>

        <Text className="text-xl font-bold">@{username}</Text>

        {!isOwnProfile && profile ? (
          <Pressable onPress={handleBlockToggle} className="p-1">
            <Ionicons
              name="ban-outline"
              size={22}
              color={profile.isBlocked ? "#ef4444" : "black"}
            />
          </Pressable>
        ) : (
          <View className="w-7" />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#000" />
            <Text className="mt-3 text-gray-500">Loading profile...</Text>
          </View>
        ) : !profile ? (
          <View className="py-20 items-center justify-center px-4">
            <Ionicons name="person-remove-outline" size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-3 text-base">User not found</Text>
          </View>
        ) : (
          <>
            {/* PROFILE INFO */}
            <View className="px-4 pt-4">
              <View className="flex-row items-center">
                {/* PROFILE IMAGE */}
                {profile.profileImage ? (
                  <Image
                    source={{ uri: profile.profileImage }}
                    className="w-24 h-24 rounded-full bg-gray-200"
                  />
                ) : (
                  <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
                    <Ionicons name="person" size={40} color="#737373" />
                  </View>
                )}

                {/* STATS */}
                <View className="flex-1 flex-row justify-around ml-5">
                  <View className="items-center">
                    <Text className="font-bold text-lg">{posts.length}</Text>
                    <Text className="text-sm text-gray-600">Posts</Text>
                  </View>

                  <View className="items-center">
                    <Text className="font-bold text-lg">
                      {profile.followersCount}
                    </Text>
                    <Text className="text-sm text-gray-600">Followers</Text>
                  </View>

                  <View className="items-center">
                    <Text className="font-bold text-lg">
                      {profile.followingCount}
                    </Text>
                    <Text className="text-sm text-gray-600">Following</Text>
                  </View>
                </View>
              </View>

              {/* NAME & BIO */}
              <View className="mt-4">
                <Text className="font-bold text-base">{profile.name}</Text>
                <Text className="text-sm mt-1 text-gray-800">
                  {profile.bio || "No bio yet"}
                </Text>
              </View>

              {/* ACTION BUTTONS */}
              {!isOwnProfile && (
                <View className="flex-row gap-2 mt-4">
                  {profile.isBlocked ? (
                    <Pressable
                      onPress={handleBlockToggle}
                      disabled={blockingLoading}
                      className="flex-1 bg-red-500 rounded-lg py-2.5 items-center"
                    >
                      {blockingLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="font-semibold text-white">Unblock</Text>
                      )}
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        onPress={handleFollowToggle}
                        disabled={followingLoading}
                        className={`flex-1 rounded-lg py-2.5 items-center ${
                          profile.isFollowing
                            ? "bg-gray-200 border border-gray-300"
                            : "bg-black"
                        }`}
                      >
                        {followingLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={profile.isFollowing ? "#000" : "#fff"}
                          />
                        ) : (
                          <Text
                            className={`font-semibold ${
                              profile.isFollowing ? "text-black" : "text-white"
                            }`}
                          >
                            {profile.isFollowing ? "Following" : "Follow"}
                          </Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={handleBlockToggle}
                        disabled={blockingLoading}
                        className="bg-gray-100 rounded-lg px-4 py-2.5 items-center border border-gray-200"
                      >
                        {blockingLoading ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Text className="font-semibold text-red-500">Block</Text>
                        )}
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* TAB BAR */}
            <View className="flex-row border-t border-gray-200 mt-5">
              <Pressable className="flex-1 items-center py-3 border-b-2 border-black">
                <Ionicons name="grid-outline" size={23} color="black" />
              </Pressable>
              <Pressable className="flex-1 items-center py-3">
                <Ionicons name="play-outline" size={24} color="gray" />
              </Pressable>
              <Pressable className="flex-1 items-center py-3">
                <Ionicons name="person-outline" size={23} color="gray" />
              </Pressable>
            </View>

            {/* BLOCKED BANNER OR POSTS GRID */}
            {profile.isBlocked ? (
              <View className="py-16 items-center justify-center px-4">
                <Ionicons name="ban-outline" size={44} color="#ef4444" />
                <Text className="font-bold text-lg text-black mt-2">
                  User Blocked
                </Text>
                <Text className="text-gray-500 text-sm mt-1 text-center">
                  You have blocked this user. Unblock to view their posts.
                </Text>
              </View>
            ) : posts.length > 0 ? (
              <View className="flex-row flex-wrap">
                {posts.map((post) => (
                  <Pressable
                    key={post.id}
                    className="w-1/3 aspect-square p-[1px]"
                  >
                    <Image
                      source={{ uri: post.mediaUrl }}
                      className="w-full h-full bg-gray-100"
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="py-16 items-center justify-center px-4">
                <View className="w-20 h-20 rounded-full border-2 border-black items-center justify-center mb-3">
                  <Ionicons name="camera-outline" size={40} color="black" />
                </View>
                <Text className="font-bold text-xl text-black">
                  No Posts Yet
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
