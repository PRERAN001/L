import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
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
}

interface UserPost {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  likesCount: number;
  createdAt: string;
}

export default function Profile() {
  const { getToken, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Settings Modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const fetchProfileData = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch("/profile/me", {}, token);

      if (data && data.user) {
        setProfile(data.user);
        setEditUsername(data.user.username || "");
        setEditName(data.user.name || "");
        setEditBio(data.user.bio || "");
      }
      if (data && data.posts) {
        setPosts(data.posts);
      }
    } catch (err: any) {
      console.log("Error loading profile:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData();
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      const updated = await apiFetch(
        "/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            username: editUsername,
            name: editName,
            bio: editBio,
          }),
        },
        token
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username: updated.username || editUsername,
              name: updated.name,
              bio: updated.bio,
            }
          : null
      );
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setShowSettingsModal(false);
      await signOut();
      router.replace("/sign-in");
    } catch (err: any) {
      Alert.alert("Error", "Failed to sign out");
    }
  };

  const username =
    profile?.username || clerkUser?.username || clerkUser?.firstName || "user";
  const name = profile?.name || clerkUser?.fullName || "User";
  const bio = profile?.bio || "No bio yet";
  const profileImage = profile?.profileImage || clerkUser?.imageUrl || "";

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-xl font-bold">@{username}</Text>

        <View className="flex-row items-center gap-5">
          <Pressable onPress={onRefresh}>
            <Ionicons name="reload-outline" size={24} color="black" />
          </Pressable>

          <Pressable onPress={() => setShowSettingsModal(true)}>
            <Ionicons name="menu-outline" size={29} color="black" />
          </Pressable>
        </View>
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
                      {profile?.followersCount ?? 0}
                    </Text>
                    <Text className="text-sm text-gray-600">Followers</Text>
                  </View>

                  <View className="items-center">
                    <Text className="font-bold text-lg">
                      {profile?.followingCount ?? 0}
                    </Text>
                    <Text className="text-sm text-gray-600">Following</Text>
                  </View>
                </View>
              </View>

              {/* BIO & EDITING */}
              {isEditing ? (
                <View className="mt-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <Text className="text-xs font-semibold text-gray-500 mb-1">
                    USERNAME
                  </Text>
                  <TextInput
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="Your Username"
                    autoCapitalize="none"
                    className="bg-white p-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                  />

                  <Text className="text-xs font-semibold text-gray-500 mb-1">
                    NAME
                  </Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Your Name"
                    className="bg-white p-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                  />

                  <Text className="text-xs font-semibold text-gray-500 mb-1">
                    BIO
                  </Text>
                  <TextInput
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Your Bio"
                    multiline
                    className="bg-white p-2.5 rounded-lg border border-gray-200 text-sm mb-3"
                  />

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setIsEditing(false)}
                      className="flex-1 bg-gray-200 py-2.5 rounded-lg items-center"
                    >
                      <Text className="font-semibold text-gray-700">
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleSaveProfile}
                      disabled={saving}
                      className="flex-1 bg-black py-2.5 rounded-lg items-center"
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="font-semibold text-white">Save</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View className="mt-4">
                  <Text className="font-bold text-base">{name}</Text>
                  <Text className="text-sm mt-1 text-gray-800">{bio}</Text>
                </View>
              )}

              {/* BUTTONS */}
              {!isEditing && (
                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={() => setIsEditing(true)}
                    className="flex-1 bg-gray-100 rounded-lg py-2.5 items-center border border-gray-200"
                  >
                    <Text className="font-semibold text-black">
                      Edit profile
                    </Text>
                  </Pressable>

                  <Pressable className="flex-1 bg-gray-100 rounded-lg py-2.5 items-center border border-gray-200">
                    <Text className="font-semibold text-black">
                      Share profile
                    </Text>
                  </Pressable>
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

            {/* USER UPLOADED POST GRID */}
            {posts.length > 0 ? (
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
              /* EMPTY STATE - NO MOCK IMAGES */
              <View className="py-16 items-center justify-center px-4">
                <View className="w-20 h-20 rounded-full border-2 border-black items-center justify-center mb-3">
                  <Ionicons name="camera-outline" size={40} color="black" />
                </View>
                <Text className="font-bold text-xl text-black">
                  No Posts Yet
                </Text>
                <Text className="text-gray-500 text-sm mt-1 text-center">
                  When you upload photos, they will appear here on your profile.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* SETTINGS MODAL */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          {/* MODAL HEADER */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
            <Pressable
              onPress={() => setShowSettingsModal(false)}
              className="p-1"
            >
              <Ionicons name="close" size={26} color="black" />
            </Pressable>
            <Text className="font-bold text-lg">Settings & Activity</Text>
            <View className="w-6" />
          </View>

          <ScrollView className="flex-1 px-4 py-2">
            {/* SETTINGS LIST */}
            <View className="py-3 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons name="person-outline" size={22} color="black" />
                <Text className="text-base text-black font-medium">
                  Account Details
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>

            <View className="py-3 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons name="lock-closed-outline" size={22} color="black" />
                <Text className="text-base text-black font-medium">
                  Privacy & Safety
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>

            <View className="py-3 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="black"
                />
                <Text className="text-base text-black font-medium">
                  Notifications
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>

            {/* SIGN OUT BUTTON */}
            <Pressable
              onPress={handleSignOut}
              className="mt-8 py-3.5 px-4 bg-red-50 rounded-xl border border-red-200 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              <Text className="text-red-500 font-bold text-base">
                Sign Out
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}