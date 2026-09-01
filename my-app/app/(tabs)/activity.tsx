import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const reels = [
  {
    id: "1",
    video:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    username: "alex",
    caption: "This place is absolutely insane 🌄",
    likes: "12.4K",
    comments: "342",
  },
  {
    id: "2",
    video:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    username: "sarah",
    caption: "Weekend energy ✨",
    likes: "8.7K",
    comments: "128",
  },
  {
    id: "3",
    video:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    username: "john",
    caption: "POV: you finally touch some grass 😂",
    likes: "21.2K",
    comments: "517",
  },
];

function Reel({ item }: { item: (typeof reels)[0] }) {
  const player = useVideoPlayer(item.video, (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <View
      style={{ height: SCREEN_HEIGHT }}
      className="bg-black"
    >
      {/* VIDEO */}
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="cover"
        nativeControls={false}
      />

      {/* DARK GRADIENT-LIKE OVERLAY */}
      <View className="absolute bottom-0 left-0 right-0 h-56 bg-black/30" />

      {/* TOP */}
      <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between">
        <Text className="text-white text-xl font-bold">
          Reels
        </Text>

        <Pressable>
          <Ionicons
            name="camera-outline"
            size={28}
            color="white"
          />
        </Pressable>
      </View>

      {/* RIGHT ACTIONS */}
      <View className="absolute right-4 bottom-28 items-center gap-6">

        <Pressable className="items-center">
          <Ionicons
            name="heart-outline"
            size={32}
            color="white"
          />

          <Text className="text-white text-xs mt-1">
            {item.likes}
          </Text>
        </Pressable>

        <Pressable className="items-center">
          <Ionicons
            name="chatbubble-outline"
            size={30}
            color="white"
          />

          <Text className="text-white text-xs mt-1">
            {item.comments}
          </Text>
        </Pressable>

        <Pressable>
          <Ionicons
            name="paper-plane-outline"
            size={30}
            color="white"
          />
        </Pressable>

        <Pressable>
          <Ionicons
            name="bookmark-outline"
            size={30}
            color="white"
          />
        </Pressable>

        <Pressable>
          <Ionicons
            name="ellipsis-horizontal"
            size={28}
            color="white"
          />
        </Pressable>
      </View>

      {/* BOTTOM INFO */}
      <View className="absolute left-4 right-20 bottom-10">

        <View className="flex-row items-center mb-3">
          <View className="w-9 h-9 rounded-full bg-gray-300 mr-3" />

          <Text className="text-white font-bold">
            @{item.username}
          </Text>

          <Pressable className="ml-3 border border-white rounded-md px-3 py-1">
            <Text className="text-white text-xs font-semibold">
              Follow
            </Text>
          </Pressable>
        </View>

        <Text className="text-white text-sm">
          {item.caption}
        </Text>

        <View className="flex-row items-center mt-3">
          <Ionicons
            name="musical-notes"
            size={15}
            color="white"
          />

          <Text className="text-white text-xs ml-2">
            Original audio • @{item.username}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function Activity() {
  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-black"
    >
      <FlatList
        data={reels}
        renderItem={({ item }) => <Reel item={item} />}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />
    </SafeAreaView>
  );
}