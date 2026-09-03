import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

export default function Create() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Allow access to your photos."
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const uploadImage = async (imgAsset: ImagePicker.ImagePickerAsset) => {
    const formData = new FormData();

    formData.append("file", {
      uri: imgAsset.uri,
      type: imgAsset.mimeType || "image/jpeg",
      name: imgAsset.fileName || "image.jpg",
    } as any);

    formData.append(
      "upload_preset",
      "blog_upload"
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/dxn29vjxu/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("Cloudinary error:", data);

      throw new Error(
        data.error?.message || "Image upload failed"
      );
    }

    return data.secure_url;
  };

  const createPost = async () => {
    if (!image) {
      Alert.alert("Select an image first");
      return;
    }

    try {
      setUploading(true);

      // 1. Upload image
      const imageUrl = await uploadImage(image);

      console.log("Cloudinary URL:", imageUrl);

      // 2. Get Clerk token
      const token = await getToken();

      // 3. Send URL to your backend via apiFetch
      const data = await apiFetch(
        "/media",
        {
          method: "POST",
          body: JSON.stringify({
            mediaUrl: imageUrl,
            mediaType: "image",
            caption: "My first real post 🚀",
          }),
        },
        token
      );

      console.log("POST CREATED:", data);

      Alert.alert("Success", "Post created!");

      setImage(null);
      router.replace("/(tabs)");

    } catch (error: any) {
      console.error(error);

      Alert.alert(
        "Error",
        error.message || "Something went wrong"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="p-5">

        <Text className="text-2xl font-bold mb-5">
          Create Post
        </Text>

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
            <Text className="text-gray-500">
              Select an image
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={createPost}
          disabled={uploading}
          className="bg-black py-4 rounded-xl mt-5 items-center"
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">
              Post
            </Text>
          )}
        </Pressable>

      </View>
    </SafeAreaView>
  );
}