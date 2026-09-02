import { useEffect } from "react";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function HostedAuthCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      router.replace("/(tabs)");
    } else {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#000" />
    </View>
  );
}
