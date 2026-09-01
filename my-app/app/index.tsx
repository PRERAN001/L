import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";

export default function Index() {
  const {
    isLoaded,
    isSignedIn,
    sessionId,
    userId,
    getToken,
  } = useAuth();

  if (!isLoaded) {
    return null;
  }

  console.log("isSignedIn:", isSignedIn);
  console.log("sessionId:", sessionId);
  console.log("userId:", userId);

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/sign-in" />;
}