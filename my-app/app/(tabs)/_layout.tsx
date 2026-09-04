import { Tabs } from 'expo-router';
import React from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const { user } = useUser();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarButton: HapticTab,
      }}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />

      {/* SEARCH */}
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />

      {/* CREATE — Instagram's rounded-square plus */}
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: ({ color }) => (
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color={color} />
            </View>
          ),
        }}
      />

      {/* REELS */}
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'film' : 'film-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />

      {/* PROFILE — the user's avatar, ringed when active */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) =>
            user?.imageUrl ? (
              <View
                style={{
                  borderWidth: 1.5,
                  borderColor: focused ? color : 'transparent',
                  borderRadius: 999,
                  padding: 1.5,
                }}
              >
                <Image
                  source={{ uri: user.imageUrl }}
                  style={{ width: 24, height: 24, borderRadius: 999 }}
                />
              </View>
            ) : (
              <Ionicons
                name={focused ? 'person-circle' : 'person-circle-outline'}
                size={28}
                color={color}
              />
            ),
        }}
      />
    </Tabs>
  );
}
