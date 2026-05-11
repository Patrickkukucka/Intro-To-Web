import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { colors } from '../theme';
import { RootStackParamList, BottomTabParamList } from '../types';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import BirdDexScreen from '../screens/BirdDexScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import SightingDetailScreen from '../screens/SightingDetailScreen';
import BirdDetailScreen from '../screens/BirdDetailScreen';
import ProUpgradeScreen from '../screens/ProUpgradeScreen';
import { useStore } from '../store/useStore';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

const tabIconMap: Record<string, { active: string; inactive: string }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Camera: { active: 'camera', inactive: 'camera-outline' },
  BirdDex: { active: 'book', inactive: 'book-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Leaderboard: { active: 'trophy', inactive: 'trophy-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          ),
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIconMap[route.name];
          return (
            <Ionicons
              name={(focused ? icons.active : icons.inactive) as keyof typeof Ionicons.glyphMap}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.cameraTab, focused && styles.cameraTabActive]}>
              <Ionicons name="camera" size={26} color={focused ? colors.background : colors.text} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen name="BirdDex" component={BirdDexScreen} options={{ tabBarLabel: 'BirdDex' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const session = useStore((s) => s.session);

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primaryLight,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="SightingDetail"
              component={SightingDetailScreen}
              options={{
                headerShown: true,
                title: 'Sighting',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
              }}
            />
            <Stack.Screen
              name="BirdDetail"
              component={BirdDetailScreen}
              options={{
                headerShown: true,
                title: 'Bird Details',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
              }}
            />
            <Stack.Screen
              name="ProUpgrade"
              component={ProUpgradeScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Go Pro',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 25 : 8,
    paddingTop: 8,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  cameraTab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 4,
  },
  cameraTabActive: {
    backgroundColor: colors.primaryLight,
  },
});
