import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, RouteProp } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { RootTabParamList } from './src/types/navigation';
import HomeScreen from './src/screens/HomeScreen';
import SafeZonesScreen from './src/screens/SafeZonesScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WelcomeAuthScreen from './src/screens/WelcomeAuthScreen';
import LocationPermissionScreen from './src/screens/LocationPermissionScreen';

import { AuthService } from './src/services/authService';
import { LocationService } from './src/services/locationService';
import { AuthUser } from './src/types';

const THEME = {
  primary: '#E63946',
  textLight: '#94A3B8',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  darkBg: '#0F172A',
};

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const color = focused ? THEME.primary : THEME.textLight;

  const icons: Record<string, string> = {
    Home: '⌂',
    'Safe Zones': '📍',
    Reports: '⚠️',
    MIA: '💬',
    Profile: '👤',
  };

  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabIconText, { color }]}>{icons[name] || '•'}</Text>
    </View>
  );
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
  const [appState, setAppState] = useState<'loading' | 'auth' | 'permission' | 'main'>('loading');

  useEffect(() => {
    checkInitialSession();

    const unsub = AuthService.onAuthStateChanged(async (user) => {
      if (!user) {
        setAppState('auth');
      }
    });

    return () => unsub();
  }, []);

  const checkInitialSession = async () => {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        setAppState('auth');
        return;
      }

      // Check if location permission is already granted without prompting
      const hasPermission = await LocationService.checkPermission();
      if (!hasPermission) {
        setAppState('permission');
      } else {
        setAppState('main');
      }
    } catch {
      setAppState('auth');
    }
  };

  const handleLoginSuccess = async (_user: AuthUser) => {
    // Check permission after successful login
    const hasPermission = await LocationService.checkPermission();
    if (!hasPermission) {
      setAppState('permission');
    } else {
      setAppState('main');
    }
  };

  const handlePermissionCompleted = () => {
    setAppState('main');
  };

  if (appState === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (appState === 'auth') {
    return (
      <SafeAreaProvider>
        <WelcomeAuthScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaProvider>
    );
  }

  if (appState === 'permission') {
    return (
      <SafeAreaProvider>
        <LocationPermissionScreen
          onPermissionGranted={handlePermissionCompleted}
          onSkip={handlePermissionCompleted}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="HomeTab"
          screenOptions={({
            route,
          }: {
            route: RouteProp<RootTabParamList, keyof RootTabParamList>;
          }) => ({
            headerShown: false,
            tabBarActiveTintColor: THEME.primary,
            tabBarInactiveTintColor: THEME.textLight,
            tabBarStyle: styles.tabBar,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarIcon: ({ focused }: { focused: boolean }) => {
              let label = 'Home';
              if (route.name === 'SafeZonesTab') label = 'Safe Zones';
              else if (route.name === 'ReportsTab') label = 'Reports';
              else if (route.name === 'ChatbotTab') label = 'MIA';
              else if (route.name === 'ProfileTab') label = 'Profile';
              return <TabIcon name={label} focused={focused} />;
            },
          })}
        >
          <Tab.Screen
            name="HomeTab"
            component={HomeScreen}
            options={{ tabBarLabel: 'Home' }}
          />
          <Tab.Screen
            name="SafeZonesTab"
            component={SafeZonesScreen}
            options={{ tabBarLabel: 'Safe Zones' }}
          />
          <Tab.Screen
            name="ReportsTab"
            component={ReportsScreen}
            options={{ tabBarLabel: 'Reports' }}
          />
          <Tab.Screen
            name="ChatbotTab"
            component={ChatbotScreen}
            options={{ tabBarLabel: 'MIA' }}
          />
          <Tab.Screen
            name="ProfileTab"
            component={ProfileScreen}
            options={{ tabBarLabel: 'Profile' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: THEME.darkBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: THEME.cardBg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
