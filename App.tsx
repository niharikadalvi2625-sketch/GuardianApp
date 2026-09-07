import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, RouteProp } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { RootTabParamList } from './src/types/navigation';
import HomeScreen from './src/screens/HomeScreen';
import SafeZonesScreen from './src/screens/SafeZonesScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const THEME = {
  primary: '#E63946',
  textLight: '#94A3B8',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
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

