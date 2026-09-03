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
import { useTheme } from "@/context/ThemeContext";

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
  const { colors, isDark } = useTheme();

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

  const displayUsername = profile?.username || username || "user";
  const name = profile?.name || "User";
  const bio = profile?.bio || "";
  const profileImage = profile?.profileImage || "";
  const isSelf =
    me?.username?.toLowerCase() === displayUsername.toLowerCase() ||
    me?.firstName?.toLowerCase() === displayUsername.toLowerCase();

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      {/* HEADER */}
      <View
        style={{ borderBottomColor: colors.border }}
        className="flex-row items-center justify-between px-4 py-3 border-b"
      >
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={{ color: colors.text }} className="text-xl font-bold">
          @{displayUsername}
        </Text>

        {!isSelf && profile ? (
          <Pressable onPress={handleBlockToggle} disabled={blockingLoading}>
            <Ionicons
              name={profile.isBlocked ? "shield-checkmark" : "shield-outline"}
              size={22}
              color={profile.isBlocked ? "#EF4444" : colors.text}
            />
          </Pressable>
        ) : (
          <View className="w-6" />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.subtext }} className="mt-3 text-sm">
              Loading user profile...
            </Text>
          </View>
        ) : (
          <>
            {/* PROFILE INFO */}
            <View className="px-4 pt-4">
              <View className="flex-row items-center">
                {/* PROFILE IMAGE */}
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    className="w-24 h-24 rounded-full bg-gray-200"
                  />
                ) : (
                  <View
                    style={{ backgroundColor: colors.card }}
                    className="w-24 h-24 rounded-full items-center justify-center border border-gray-200 dark:border-gray-800"
                  >
                    <Ionicons name="person" size={40} color={colors.subtext} />
                  </View>
                )}

                {/* STATS */}
                <View className="flex-1 flex-row justify-around ml-5">
                  <View className="items-center">
                    <Text
                      style={{ color: colors.text }}
                      className="font-bold text-lg"
                    >
                      {posts.length}
                    </Text>
                    <Text style={{ color: colors.subtext }} className="text-xs">
                      Posts
                    </Text>
                  </View>

                  <View className="items-center">
                    <Text
                      style={{ color: colors.text }}
                      className="font-bold text-lg"
                    >
                      {profile?.followersCount ?? 0}
                    </Text>
                    <Text style={{ color: colors.subtext }} className="text-xs">
                      Followers
                    </Text>
                  </View>

                  <View className="items-center">
                    <Text
                      style={{ color: colors.text }}
                      className="font-bold text-lg"
                    >
                      {profile?.followingCount ?? 0}
                    </Text>
                    <Text style={{ color: colors.subtext }} className="text-xs">
                      Following
                    </Text>
                  </View>
                </View>
              </View>

              {/* BIO */}
              <View className="mt-4">
                <Text style={{ color: colors.text }} className="font-bold text-base">
                  {name}
                </Text>
                {bio ? (
                  <Text style={{ color: colors.text }} className="text-sm mt-1">
                    {bio}
                  </Text>
                ) : null}
              </View>

              {/* ACTION BUTTONS */}
              {!isSelf && profile && (
                <View className="flex-row gap-2 mt-4">
                  {profile.isBlocked ? (
                    <Pressable
                      onPress={handleBlockToggle}
                      style={{
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      }}
                      className="flex-1 rounded-lg py-2.5 items-center border"
                    >
                      <Text
                        style={{ color: colors.text }}
                        className="font-semibold text-sm"
                      >
                        Unblock User
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        onPress={handleFollowToggle}
                        disabled={followingLoading}
                        style={{
                          backgroundColor: profile.isFollowing
                            ? colors.inputBg
                            : "#3B82F6",
                          borderColor: colors.border,
                        }}
                        className="flex-1 rounded-lg py-2.5 items-center border border-transparent"
                      >
                        {followingLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text
                            style={{
                              color: profile.isFollowing
                                ? colors.text
                                : "#FFFFFF",
                            }}
                            className="font-semibold text-sm"
                          >
                            {profile.isFollowing ? "Following" : "Follow"}
                          </Text>
                        )}
                      </Pressable>

                      <Pressable
                        style={{
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                        }}
                        className="flex-1 rounded-lg py-2.5 items-center border"
                      >
                        <Text
                          style={{ color: colors.text }}
                          className="font-semibold text-sm"
                        >
                          Message
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* TAB BAR */}
            <View
              style={{ borderTopColor: colors.border }}
              className="flex-row border-t mt-5"
            >
              <Pressable
                style={{ borderBottomColor: colors.text }}
                className="flex-1 items-center py-3 border-b-2"
              >
                <Ionicons name="grid-outline" size={23} color={colors.text} />
              </Pressable>
            </View>

            {/* POSTS GRID */}
            {profile?.isBlocked ? (
              <View className="py-16 items-center justify-center px-4">
                <Ionicons
                  name="shield-outline"
                  size={48}
                  color={colors.subtext}
                />
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-lg mt-2"
                >
                  User Blocked
                </Text>
                <Text
                  style={{ color: colors.subtext }}
                  className="text-xs mt-1 text-center"
                >
                  Unblock this user to see their posts and profile activity.
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
                      className="w-full h-full bg-gray-200 dark:bg-slate-800"
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="py-16 items-center justify-center px-4">
                <Ionicons
                  name="camera-outline"
                  size={48}
                  color={colors.subtext}
                />
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-lg mt-2"
                >
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
