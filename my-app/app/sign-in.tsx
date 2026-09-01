import { useAuth } from "@clerk/expo";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export default function SignInScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { startHostedAuth } = useHostedAuth();

  const handleSignIn = async () => {
    try {
      await startHostedAuth({
        mode: "sign-in",
      });
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignUp = async () => {
    try {
      await startHostedAuth({
        mode: "sign-up",
      });
    } catch (error) {
      console.error("Sign up error:", error);
    }
  };

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isSignedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg font-semibold">
          You're signed in
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-8">

        {/* LOGO */}
        <View className="items-center mb-12">
          <Text
            className="text-5xl font-bold"
            style={{
              fontFamily: Platform.OS === "ios"
                ? "System"
                : "sans-serif",
            }}
          >
            Instagram
          </Text>
        </View>

        {/* INPUTS */}
        <View className="gap-2">

          <TextInput
            placeholder="Phone number, username, or email"
            placeholderTextColor="#737373"
            autoCapitalize="none"
            className="h-12 border border-gray-300 rounded-md px-4 bg-gray-50 text-sm"
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#737373"
            secureTextEntry
            className="h-12 border border-gray-300 rounded-md px-4 bg-gray-50 text-sm"
          />

        </View>

        {/* LOGIN */}
        <Pressable
          onPress={handleSignIn}
          className="h-11 bg-[#0095F6] rounded-lg items-center justify-center mt-3"
        >
          <Text className="text-white font-bold">
            Log in
          </Text>
        </Pressable>

        {/* FORGOT PASSWORD */}
        <Pressable className="items-center mt-5">
          <Text className="text-[#00376B] font-semibold text-sm">
            Forgot password?
          </Text>
        </Pressable>

        {/* OR */}
        <View className="flex-row items-center my-8">

          <View className="flex-1 h-[1px] bg-gray-300" />

          <Text className="mx-5 text-gray-500 font-semibold text-xs">
            OR
          </Text>

          <View className="flex-1 h-[1px] bg-gray-300" />

        </View>

        {/* FACEBOOK */}
        <Pressable
          onPress={handleSignIn}
          className="flex-row items-center justify-center"
        >
          <Text className="text-[#385185] text-base font-bold">
            f
          </Text>

          <Text className="text-[#385185] font-bold ml-2">
            Log in with Facebook
          </Text>
        </Pressable>

        {/* SPACER */}
        <View className="h-16" />

        {/* SIGN UP BOX */}
        <View className="border-t border-gray-200 pt-6 items-center">

          <View className="flex-row">
            <Text className="text-gray-600">
              Don't have an account?
            </Text>

            <Pressable onPress={handleSignUp}>
              <Text className="text-[#0095F6] font-bold ml-1">
                Sign up
              </Text>
            </Pressable>
          </View>

        </View>

      </View>

      {/* FOOTER */}
      <View className="items-center pb-8">
        <Text className="text-gray-400 text-xs">
          © 2026 YourApp
        </Text>
      </View>

    </KeyboardAvoidingView>
  );
}