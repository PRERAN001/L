import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

type ContentType = "post" | "story" | "reel";

export default function Create() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [contentType, setContentType] = useState<ContentType>("post");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: contentType === "reel" ? ["videos"] : ["images", "videos"],
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: contentType === "story" ? 30 : 90,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const uploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    const formData = new FormData();

    const isVideo = asset.type === "video";
    formData.append("file", {
      uri: asset.uri,
      type: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
      name: asset.fileName || (isVideo ? "video.mp4" : "image.jpg"),
    } as any);

    formData.append("upload_preset", "blog_upload");
    formData.append("resource_type", isVideo ? "video" : "image");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/dxn29vjxu/${isVideo ? "video" : "image"}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("Cloudinary error:", data);
      throw new Error(data.error?.message || "Upload failed");
    }

    return data.secure_url;
  };

  const handleCreate = async () => {
    if (!image) {
      Alert.alert("Select media first");
      return;
    }

    try {
      setUploading(true);

      // 1. Upload to Cloudinary
      const mediaUrl = await uploadMedia(image);

      // 2. Get Clerk token
      const token = await getToken();

      const isVideo = image.type === "video";
      const mediaType = isVideo ? "video" : "image";

      // 3. Send to appropriate endpoint
      const endpoint =
        contentType === "story"
          ? "/stories"
          : "/media"; // posts + reels both go to /media; mediaType="video" makes it a reel
      await apiFetch(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({
            mediaUrl,
            mediaType,
            caption: caption.trim(),
          }),
        },
        token
      );

      Alert.alert(
        "Success!",
        contentType === "story"
          ? "Your story is live for 24 hours."
          : contentType === "reel"
          ? "Your reel is live."
          : "Your post is live."
      );

      setImage(null);
      setCaption("");
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-bold mb-5">Create</Text>

          {/* Type selector */}
          <View className="flex-row gap-2 mb-4">
            <Pressable
              onPress={() => setContentType("post")}
              className="flex-1 py-3 rounded-lg items-center"
              style={{
                backgroundColor: contentType === "post" ? "#000" : "#f3f4f6",
              }}
            >
              <Text
                className="font-semibold"
                style={{ color: contentType === "post" ? "#fff" : "#6b7280" }}
              >
                📷 Post
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setContentType("reel")}
              className="flex-1 py-3 rounded-lg items-center"
              style={{
                backgroundColor: contentType === "reel" ? "#000" : "#f3f4f6",
              }}
            >
              <Text
                className="font-semibold"
                style={{ color: contentType === "reel" ? "#fff" : "#6b7280" }}
              >
                🎬 Reel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setContentType("story")}
              className="flex-1 py-3 rounded-lg items-center"
              style={{
                backgroundColor: contentType === "story" ? "#000" : "#f3f4f6",
              }}
            >
              <Text
                className="font-semibold"
                style={{ color: contentType === "story" ? "#fff" : "#6b7280" }}
              >
                ⏱ Story
              </Text>
            </Pressable>
          </View>

          {/* Media picker */}
          <Pressable
            onPress={pickImage}
            className="h-80 bg-gray-100 rounded-xl items-center justify-center overflow-hidden"
          >
            {image ? (
              <Image
                source={{ uri: image.uri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center gap-2">
                <Text className="text-4xl">
                  {contentType === "reel" ? "🎬" : contentType === "story" ? "🎞" : "📷"}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {contentType === "reel"
                    ? "Tap to select a video"
                    : contentType === "story"
                    ? "Tap to select photo/video"
                    : "Tap to select a photo"}
                </Text>
                {contentType === "story" && (
                  <Text className="text-gray-400 text-xs">Max 30s video</Text>
                )}
                {contentType === "reel" && (
                  <Text className="text-gray-400 text-xs">Max 90s video</Text>
                )}
              </View>
            )}
          </Pressable>

          {/* Caption input */}
          <View className="mt-4">
            <Text className="text-sm font-medium text-gray-600 mb-1">
              Caption {contentType === "story" ? "(optional)" : contentType === "reel" ? "(optional)" : ""}
            </Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={
                contentType === "story"
                  ? "Add a caption… (helps personalise your feed)"
                  : contentType === "reel"
                  ? "Describe your reel… (helps personalise your feed)"
                  : "Write a caption… (helps personalise your feed)"
              }
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 min-h-[80px]"
              style={{ textAlignVertical: "top" }}
            />
            <Text className="text-xs text-gray-400 text-right mt-1">
              {caption.length}/500
            </Text>
          </View>

          {/* Share button */}
          <Pressable
            onPress={handleCreate}
            disabled={uploading || !image}
            className="py-4 rounded-xl mt-5 items-center"
            style={{
              backgroundColor: uploading || !image ? "#d1d5db" : "#000",
            }}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">
                {contentType === "story"
                  ? "Share Story"
                  : contentType === "reel"
                  ? "Share Reel"
                  : "Share Post"}
              </Text>
            )}
          </Pressable>

          {contentType === "story" && (
            <Text className="text-xs text-gray-500 text-center mt-3">
              Stories disappear after 24 hours
            </Text>
          )}
          {contentType === "reel" && (
            <Text className="text-xs text-gray-500 text-center mt-3">
              Reels appear in the Reels tab for everyone
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
