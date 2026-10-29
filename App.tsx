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
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const TabIcon = ({
  name,
  focused,
  primaryColor,
  inactiveColor,
}: {
  name: string;
  focused: boolean;
  primaryColor: string;
  inactiveColor: string;
}) => {
  const color = focused ? primaryColor : inactiveColor;

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

function AppContent() {
  const { theme } = useTheme();
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
      <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (appState === 'auth') {
    return <WelcomeAuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (appState === 'permission') {
    return (
      <LocationPermissionScreen
        onPermissionGranted={handlePermissionCompleted}
        onSkip={handlePermissionCompleted}
      />
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={({
          route,
        }: {
          route: RouteProp<RootTabParamList, keyof RootTabParamList>;
        }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: theme.tabBarBg,
              borderTopColor: theme.tabBarBorder,
            },
          ],
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ focused }: { focused: boolean }) => {
            let label = 'Home';
            if (route.name === 'SafeZonesTab') label = 'Safe Zones';
            else if (route.name === 'ReportsTab') label = 'Reports';
            else if (route.name === 'ChatbotTab') label = 'MIA';
            else if (route.name === 'ProfileTab') label = 'Profile';
            return (
              <TabIcon
                name={label}
                focused={focused}
                primaryColor={theme.primary}
                inactiveColor={theme.textMuted}
              />
            );
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
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    borderTopWidth: 1,
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
