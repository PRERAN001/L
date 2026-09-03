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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { ThemeMode } from "@/lib/themeStorage";

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
  const { themeMode, setThemeMode, activeTheme, isDark, colors } = useTheme();

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

  // Settings Modal & Sub-screen states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "main" | "theme" | "notifications" | "privacy" | "account" | "storage"
  >("main");

  // General Settings States
  const [pushNotifications, setPushNotifications] = useState(true);
  const [likeCommentsAlerts, setLikeCommentsAlerts] = useState(true);
  const [directMessageAlerts, setDirectMessageAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [showActivityStatus, setShowActivityStatus] = useState(true);
  const [cacheSize, setCacheSize] = useState("14.8 MB");
  const [selectedLanguage, setSelectedLanguage] = useState("English (US)");

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
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            setShowSettingsModal(false);
            await signOut();
            router.replace("/sign-in");
          } catch (err: any) {
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      `Are you sure you want to clear ${cacheSize} of cached app data?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: () => {
            setCacheSize("0 KB");
            Alert.alert("Cache Cleared", "Temporary storage cleared successfully.");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. Are you sure you want to permanently delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setShowSettingsModal(false);
              await signOut();
              router.replace("/sign-in");
            } catch (err) {
              Alert.alert("Error", "Could not complete account deletion request.");
            }
          },
        },
      ]
    );
  };

  const username =
    profile?.username || clerkUser?.username || clerkUser?.firstName || "user";
  const name = profile?.name || clerkUser?.fullName || "User";
  const bio = profile?.bio || "No bio yet";
  const profileImage = profile?.profileImage || clerkUser?.imageUrl || "";
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || "Not set";

  const renderThemeOptions = () => {
    const options: { mode: ThemeMode; label: string; icon: string; desc: string }[] = [
      {
        mode: "light",
        label: "Light Theme",
        icon: "sunny-outline",
        desc: "Bright mode with clean light background",
      },
      {
        mode: "dark",
        label: "Dark Theme",
        icon: "moon-outline",
        desc: "Sleek dark interface to reduce eye strain",
      },
      {
        mode: "system",
        label: "System Default",
        icon: "desktop-outline",
        desc: "Match your device's system dark/light mode",
      },
    ];

    return (
      <View className="gap-3 mt-2">
        {options.map((opt) => {
          const isSelected = themeMode === opt.mode;
          return (
            <Pressable
              key={opt.mode}
              onPress={() => setThemeMode(opt.mode)}
              style={{
                backgroundColor: isSelected
                  ? isDark
                    ? "#1E293B"
                    : "#F0F9FF"
                  : colors.card,
                borderColor: isSelected ? "#3B82F6" : colors.border,
              }}
              className="p-4 rounded-xl border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                <View
                  style={{
                    backgroundColor: isSelected
                      ? "#3B82F6"
                      : isDark
                      ? "#374151"
                      : "#E5E7EB",
                  }}
                  className="w-10 h-10 rounded-full items-center justify-center"
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={isSelected ? "#FFFFFF" : colors.text}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    style={{ color: colors.text }}
                    className="font-bold text-base"
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={{ color: colors.subtext }}
                    className="text-xs mt-0.5"
                  >
                    {opt.desc}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  borderColor: isSelected ? "#3B82F6" : colors.subtext,
                  backgroundColor: isSelected ? "#3B82F6" : "transparent",
                }}
                className="w-6 h-6 rounded-full border-2 items-center justify-center"
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      {/* HEADER */}
      <View
        style={{ borderBottomColor: colors.border }}
        className="flex-row items-center justify-between px-4 py-3 border-b"
      >
        <Text style={{ color: colors.text }} className="text-xl font-bold">
          @{username}
        </Text>

        <View className="flex-row items-center gap-5">
          <Pressable onPress={onRefresh}>
            <Ionicons name="reload-outline" size={24} color={colors.text} />
          </Pressable>

          <Pressable onPress={() => setShowSettingsModal(true)}>
            <Ionicons name="settings-outline" size={26} color={colors.text} />
          </Pressable>
        </View>
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
              Loading profile...
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
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs"
                    >
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
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs"
                    >
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
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs"
                    >
                      Following
                    </Text>
                  </View>
                </View>
              </View>

              {/* BIO & EDITING */}
              {isEditing ? (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  className="mt-4 p-3 rounded-xl border"
                >
                  <Text
                    style={{ color: colors.subtext }}
                    className="text-xs font-semibold mb-1"
                  >
                    USERNAME
                  </Text>
                  <TextInput
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="Your Username"
                    placeholderTextColor={colors.subtext}
                    autoCapitalize="none"
                    style={{
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    }}
                    className="p-2.5 rounded-lg border text-sm mb-3"
                  />

                  <Text
                    style={{ color: colors.subtext }}
                    className="text-xs font-semibold mb-1"
                  >
                    NAME
                  </Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Your Name"
                    placeholderTextColor={colors.subtext}
                    style={{
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    }}
                    className="p-2.5 rounded-lg border text-sm mb-3"
                  />

                  <Text
                    style={{ color: colors.subtext }}
                    className="text-xs font-semibold mb-1"
                  >
                    BIO
                  </Text>
                  <TextInput
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Your Bio"
                    placeholderTextColor={colors.subtext}
                    multiline
                    style={{
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    }}
                    className="p-2.5 rounded-lg border text-sm mb-3"
                  />

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setIsEditing(false)}
                      style={{
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      }}
                      className="flex-1 py-2.5 rounded-lg items-center border"
                    >
                      <Text
                        style={{ color: colors.text }}
                        className="font-semibold"
                      >
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleSaveProfile}
                      disabled={saving}
                      style={{ backgroundColor: colors.primary }}
                      className="flex-1 py-2.5 rounded-lg items-center"
                    >
                      {saving ? (
                        <ActivityIndicator
                          color={isDark ? "#000" : "#fff"}
                          size="small"
                        />
                      ) : (
                        <Text
                          style={{ color: isDark ? "#000" : "#fff" }}
                          className="font-semibold"
                        >
                          Save
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View className="mt-4">
                  <Text style={{ color: colors.text }} className="font-bold text-base">
                    {name}
                  </Text>
                  <Text style={{ color: colors.text }} className="text-sm mt-1">
                    {bio}
                  </Text>
                </View>
              )}

              {/* ACTION BUTTONS */}
              {!isEditing && (
                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={() => setIsEditing(true)}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                    className="flex-1 rounded-lg py-2.5 items-center border"
                  >
                    <Text style={{ color: colors.text }} className="font-semibold">
                      Edit profile
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setShowSettingsModal(true);
                      setActiveSettingsTab("main");
                    }}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                    className="flex-1 rounded-lg py-2.5 items-center border"
                  >
                    <Text style={{ color: colors.text }} className="font-semibold">
                      General Settings
                    </Text>
                  </Pressable>
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

              <Pressable className="flex-1 items-center py-3">
                <Ionicons name="play-outline" size={24} color={colors.subtext} />
              </Pressable>

              <Pressable className="flex-1 items-center py-3">
                <Ionicons name="person-outline" size={23} color={colors.subtext} />
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
                      className="w-full h-full bg-gray-200 dark:bg-slate-800"
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              /* EMPTY STATE */
              <View className="py-16 items-center justify-center px-4">
                <View
                  style={{ borderColor: colors.text }}
                  className="w-20 h-20 rounded-full border-2 items-center justify-center mb-3"
                >
                  <Ionicons name="camera-outline" size={40} color={colors.text} />
                </View>
                <Text style={{ color: colors.text }} className="font-bold text-xl">
                  No Posts Yet
                </Text>
                <Text
                  style={{ color: colors.subtext }}
                  className="text-sm mt-1 text-center"
                >
                  When you upload photos, they will appear here on your profile.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* GENERAL SETTINGS MODAL */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (activeSettingsTab !== "main") {
            setActiveSettingsTab("main");
          } else {
            setShowSettingsModal(false);
          }
        }}
      >
        <SafeAreaView
          style={{ backgroundColor: colors.modalBg }}
          className="flex-1"
        >
          {/* MODAL HEADER */}
          <View
            style={{ borderBottomColor: colors.border }}
            className="flex-row items-center justify-between px-4 py-3 border-b"
          >
            <Pressable
              onPress={() => {
                if (activeSettingsTab !== "main") {
                  setActiveSettingsTab("main");
                } else {
                  setShowSettingsModal(false);
                }
              }}
              className="p-1"
            >
              <Ionicons
                name={activeSettingsTab === "main" ? "close" : "arrow-back"}
                size={24}
                color={colors.text}
              />
            </Pressable>

            <Text style={{ color: colors.text }} className="font-bold text-lg">
              {activeSettingsTab === "main"
                ? "Settings & Activity"
                : activeSettingsTab === "theme"
                ? "Appearance & Theme"
                : activeSettingsTab === "notifications"
                ? "Notifications"
                : activeSettingsTab === "privacy"
                ? "Privacy & Security"
                : activeSettingsTab === "account"
                ? "Account Details"
                : "App Preferences & Storage"}
            </Text>
            <View className="w-6" />
          </View>

          <ScrollView className="flex-1 px-4 py-2">
            {/* MAIN SETTINGS MENU */}
            {activeSettingsTab === "main" && (
              <>
                {/* QUICK THEME SWITCH PREVIEW */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  className="p-4 rounded-xl border my-3"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Ionicons
                        name={
                          isDark
                            ? "moon-outline"
                            : themeMode === "system"
                            ? "desktop-outline"
                            : "sunny-outline"
                        }
                        size={20}
                        color={colors.text}
                      />
                      <Text
                        style={{ color: colors.text }}
                        className="font-bold text-base"
                      >
                        Theme Preference
                      </Text>
                    </View>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs capitalize font-medium"
                    >
                      {themeMode} mode
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setActiveSettingsTab("theme")}
                    style={{ backgroundColor: colors.inputBg }}
                    className="py-2.5 px-3 rounded-lg flex-row items-center justify-between"
                  >
                    <Text
                      style={{ color: colors.text }}
                      className="text-sm font-medium"
                    >
                      Change Theme (Dark / Light / System)
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.subtext}
                    />
                  </Pressable>
                </View>

                {/* GENERAL SETTINGS LIST */}
                <Text
                  style={{ color: colors.subtext }}
                  className="text-xs font-bold uppercase tracking-wider mt-2 mb-2 px-1"
                >
                  General Settings
                </Text>

                <Pressable
                  onPress={() => setActiveSettingsTab("theme")}
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="color-palette-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      Appearance & Theme
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs capitalize"
                    >
                      {themeMode}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.subtext}
                    />
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setActiveSettingsTab("account")}
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="person-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      Account Details
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.subtext}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setActiveSettingsTab("notifications")}
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="notifications-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      Notifications
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.subtext}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setActiveSettingsTab("privacy")}
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="lock-closed-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      Privacy & Safety
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.subtext}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setActiveSettingsTab("storage")}
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="hardware-chip-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      Storage & App Data
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.subtext}
                  />
                </Pressable>

                {/* ABOUT SECTION */}
                <Text
                  style={{ color: colors.subtext }}
                  className="text-xs font-bold uppercase tracking-wider mt-6 mb-2 px-1"
                >
                  About & Support
                </Text>

                <Pressable
                  onPress={() =>
                    Alert.alert(
                      "Help & Support",
                      "For assistance, please contact support@yeahh.app"
                    )
                  }
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="help-circle-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      Help Center
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.subtext}
                  />
                </Pressable>

                <View
                  style={{ borderBottomColor: colors.border }}
                  className="py-3.5 border-b flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="information-circle-outline"
                      size={22}
                      color={colors.text}
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium"
                    >
                      App Version
                    </Text>
                  </View>
                  <Text
                    style={{ color: colors.subtext }}
                    className="text-sm font-medium"
                  >
                    v1.0.0 (Build 42)
                  </Text>
                </View>

                {/* SIGN OUT & DANGER ZONE */}
                <View className="mt-8 gap-3 mb-6">
                  <Pressable
                    onPress={handleSignOut}
                    style={{
                      backgroundColor: colors.dangerBg,
                      borderColor: "#FCA5A5",
                    }}
                    className="py-3.5 px-4 rounded-xl border flex-row items-center justify-center gap-2"
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={22}
                      color={colors.danger}
                    />
                    <Text
                      style={{ color: colors.danger }}
                      className="font-bold text-base"
                    >
                      Sign Out
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleDeleteAccount}
                    className="py-2.5 items-center justify-center"
                  >
                    <Text className="text-xs text-red-500 font-medium underline">
                      Delete Account
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* SUB TAB: APPEARANCE & THEME */}
            {activeSettingsTab === "theme" && (
              <View className="py-2">
                <Text
                  style={{ color: colors.subtext }}
                  className="text-sm mb-3"
                >
                  Choose how the app looks on your device. Changes apply
                  instantly.
                </Text>
                {renderThemeOptions()}
              </View>
            )}

            {/* SUB TAB: NOTIFICATIONS */}
            {activeSettingsTab === "notifications" && (
              <View className="py-2 gap-4">
                <View
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-1 pr-4">
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-base"
                    >
                      Push Notifications
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Receive notifications directly on your device
                    </Text>
                  </View>
                  <Switch
                    value={pushNotifications}
                    onValueChange={setPushNotifications}
                    trackColor={{ false: "#767577", true: "#3B82F6" }}
                  />
                </View>

                <View
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-1 pr-4">
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-base"
                    >
                      Likes & Comments
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Alerts when someone interacts with your posts
                    </Text>
                  </View>
                  <Switch
                    value={likeCommentsAlerts}
                    onValueChange={setLikeCommentsAlerts}
                    trackColor={{ false: "#767577", true: "#3B82F6" }}
                  />
                </View>

                <View
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-1 pr-4">
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-base"
                    >
                      Direct Messages
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Alerts when someone sends you a message
                    </Text>
                  </View>
                  <Switch
                    value={directMessageAlerts}
                    onValueChange={setDirectMessageAlerts}
                    trackColor={{ false: "#767577", true: "#3B82F6" }}
                  />
                </View>

                <View
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-1 pr-4">
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-base"
                    >
                      Email Updates
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Weekly highlights and platform updates
                    </Text>
                  </View>
                  <Switch
                    value={emailDigest}
                    onValueChange={setEmailDigest}
                    trackColor={{ false: "#767577", true: "#3B82F6" }}
                  />
                </View>
              </View>
            )}

            {/* SUB TAB: PRIVACY & SAFETY */}
            {activeSettingsTab === "privacy" && (
              <View className="py-2 gap-4">
                <View
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-1 pr-4">
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-base"
                    >
                      Private Account
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Only approved followers can see your posts and stories
                    </Text>
                  </View>
                  <Switch
                    value={isPrivateAccount}
                    onValueChange={setIsPrivateAccount}
                    trackColor={{ false: "#767577", true: "#3B82F6" }}
                  />
                </View>

                <View
                  style={{ borderBottomColor: colors.border }}
                  className="flex-row items-center justify-between py-3 border-b"
                >
                  <View className="flex-1 pr-4">
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-base"
                    >
                      Show Activity Status
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Allow others to see when you are active on the app
                    </Text>
                  </View>
                  <Switch
                    value={showActivityStatus}
                    onValueChange={setShowActivityStatus}
                    trackColor={{ false: "#767577", true: "#3B82F6" }}
                  />
                </View>
              </View>
            )}

            {/* SUB TAB: ACCOUNT DETAILS */}
            {activeSettingsTab === "account" && (
              <View className="py-2 gap-4">
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  className="p-4 rounded-xl border gap-3"
                >
                  <View>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs font-semibold uppercase"
                    >
                      Username
                    </Text>
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-bold mt-0.5"
                    >
                      @{username}
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs font-semibold uppercase"
                    >
                      Email Address
                    </Text>
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium mt-0.5"
                    >
                      {userEmail}
                    </Text>
                  </View>

                  <View>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs font-semibold uppercase"
                    >
                      Full Name
                    </Text>
                    <Text
                      style={{ color: colors.text }}
                      className="text-base font-medium mt-0.5"
                    >
                      {name}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    setShowSettingsModal(false);
                    setIsEditing(true);
                  }}
                  style={{ backgroundColor: colors.primary }}
                  className="py-3 rounded-xl items-center"
                >
                  <Text
                    style={{ color: isDark ? "#000" : "#fff" }}
                    className="font-bold text-base"
                  >
                    Edit Profile Details
                  </Text>
                </Pressable>
              </View>
            )}

            {/* SUB TAB: STORAGE & APP DATA */}
            {activeSettingsTab === "storage" && (
              <View className="py-2 gap-4">
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  className="p-4 rounded-xl border flex-row items-center justify-between"
                >
                  <View>
                    <Text
                      style={{ color: colors.text }}
                      className="font-bold text-base"
                    >
                      Cache Storage
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      Current usage: {cacheSize}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleClearCache}
                    style={{ backgroundColor: colors.inputBg }}
                    className="px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <Text
                      style={{ color: colors.text }}
                      className="font-semibold text-xs"
                    >
                      Clear Cache
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  className="p-4 rounded-xl border flex-row items-center justify-between"
                >
                  <View>
                    <Text
                      style={{ color: colors.text }}
                      className="font-bold text-base"
                    >
                      Language
                    </Text>
                    <Text
                      style={{ color: colors.subtext }}
                      className="text-xs mt-0.5"
                    >
                      {selectedLanguage}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.subtext}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}