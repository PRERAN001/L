import { Tabs } from 'expo-router'
import React from 'react'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { HapticTab } from '@/components/haptic-tab'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#888',

        tabBarButton: HapticTab,
      }}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* SEARCH */}
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="search"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* CREATE */}
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="add-box"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ACTIVITY */}
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="favorite-border"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="person-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}