import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const recentPhotos = [
  "https://picsum.photos/400/400?random=101",
  "https://picsum.photos/400/400?random=102",
  "https://picsum.photos/400/400?random=103",
  "https://picsum.photos/400/400?random=104",
  "https://picsum.photos/400/400?random=105",
  "https://picsum.photos/400/400?random=106",
  "https://picsum.photos/400/400?random=107",
  "https://picsum.photos/400/400?random=108",
  "https://picsum.photos/400/400?random=109",
];

export default function Create() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <Pressable>
            <Ionicons
              name="close"
              size={28}
              color="black"
            />
          </Pressable>

          <Text className="text-lg font-bold">
            Create
          </Text>

          <Pressable>
            <Text className="text-blue-500 font-bold">
              Next
            </Text>
          </Pressable>
        </View>

        {/* MEDIA PREVIEW */}
        <View className="bg-black aspect-square">
          <Image
            source={{
              uri: recentPhotos[0],
            }}
            className="w-full h-full"
            resizeMode="cover"
          />

          {/* CAMERA BUTTON */}
          <Pressable className="absolute bottom-4 left-4 bg-black/60 rounded-full p-3">
            <Ionicons
              name="camera"
              size={24}
              color="white"
            />
          </Pressable>

          {/* GALLERY BUTTON */}
          <Pressable className="absolute bottom-4 right-4 bg-black/60 rounded-full p-3">
            <Ionicons
              name="images"
              size={24}
              color="white"
            />
          </Pressable>
        </View>

        {/* POST TYPE */}
        <View className="flex-row justify-around py-4 border-b border-gray-200">

          <Pressable className="items-center">
            <Ionicons
              name="image-outline"
              size={25}
              color="black"
            />
            <Text className="text-xs mt-1">
              Post
            </Text>
          </Pressable>

          <Pressable className="items-center">
            <Ionicons
              name="play-outline"
              size={25}
              color="black"
            />
            <Text className="text-xs mt-1">
              Reel
            </Text>
          </Pressable>

          <Pressable className="items-center">
            <Ionicons
              name="book-outline"
              size={25}
              color="black"
            />
            <Text className="text-xs mt-1">
              Story
            </Text>
          </Pressable>

          <Pressable className="items-center">
            <Ionicons
              name="videocam-outline"
              size={25}
              color="black"
            />
            <Text className="text-xs mt-1">
              Live
            </Text>
          </Pressable>

        </View>

        {/* RECENT */}
        <View className="px-4 py-4">

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold">
              Recent
            </Text>

            <Pressable>
              <Text className="text-blue-500 font-semibold">
                Select multiple
              </Text>
            </Pressable>
          </View>

          {/* GALLERY */}
          <View className="flex-row flex-wrap">
            {recentPhotos.map((photo, index) => (
              <Pressable
                key={index}
                className="w-1/3 aspect-square p-[1px]"
              >
                <Image
                  source={{ uri: photo }}
                  className="w-full h-full"
                  resizeMode="cover"
                />

                {/* SELECTED INDICATOR */}
                {index === 0 && (
                  <View className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 items-center justify-center">
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color="white"
                    />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}