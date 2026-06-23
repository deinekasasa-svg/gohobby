// Навигация приложения.
// AuthStack: Онбординг → Регистрация → Создание профиля (по состоянию AuthContext).
// MainTabs: Поиск · «+» (модалка создания) · Чаты · Профиль.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native'; // View used in loading screen
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { subscribeChats } from '../services/data';
import { colors } from '../theme';

import OnboardingScreen from '../screens/OnboardingScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CreateProfileScreen from '../screens/CreateProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateActivityScreen from '../screens/CreateActivityScreen';
import MyActivitiesScreen from '../screens/MyActivitiesScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';

const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { currentUser } = useAuth();
  const [unreadChats, setUnreadChats] = useState(0);

  // Считаем диалоги с непрочитанными сообщениями от собеседника (для бейджа).
  useEffect(() => {
    if (!currentUser) return;
    return subscribeChats(currentUser, (chats) => {
      const n = chats.filter(
        (c) =>
          c.lastSenderId !== currentUser.id &&
          c.lastSenderId !== 'system' &&
          c.lastMessageAt > (c.readAt?.[currentUser.id] ?? 0),
      ).length;
      setUnreadChats(n);
    });
  }, [currentUser]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Поиск',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyActivities"
        component={MyActivitiesScreen}
        options={{
          title: 'Мои активности',
          tabBarLabelStyle: { fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: 'Чаты',
          tabBarBadge: unreadChats || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#fff', fontSize: 11 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { initializing, onboardingSeen, currentUser, pendingTelegram } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      {!onboardingSeen ? (
        <RootStack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
      ) : !currentUser ? (
        pendingTelegram ? (
          <RootStack.Screen
            name="CreateProfile"
            component={CreateProfileScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <RootStack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
        )
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <RootStack.Screen
            name="CreateActivity"
            component={CreateActivityScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <RootStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат' }} />
          <RootStack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ title: 'Профиль' }}
          />
          <RootStack.Screen
            name="ActivityDetail"
            component={ActivityDetailScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EditActivity"
            component={CreateActivityScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </>
      )}
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
