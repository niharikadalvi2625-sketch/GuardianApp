import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';

export type RootTabParamList = {
  HomeTab: undefined;
  SafeZonesTab: { category?: string } | undefined;
  ReportsTab: undefined;
  ChatbotTab: { initialQuery?: string } | undefined;
  ProfileTab: undefined;
};

export type HomeScreenNavigationProp = BottomTabNavigationProp<
  RootTabParamList,
  'HomeTab'
>;

export type SafeZonesScreenNavigationProp = BottomTabNavigationProp<
  RootTabParamList,
  'SafeZonesTab'
>;

export type ReportsScreenNavigationProp = BottomTabNavigationProp<
  RootTabParamList,
  'ReportsTab'
>;

export type ChatbotScreenNavigationProp = BottomTabNavigationProp<
  RootTabParamList,
  'ChatbotTab'
>;

export type ProfileScreenNavigationProp = BottomTabNavigationProp<
  RootTabParamList,
  'ProfileTab'
>;

export type SafeZonesRouteProp = RouteProp<RootTabParamList, 'SafeZonesTab'>;
export type ChatbotRouteProp = RouteProp<RootTabParamList, 'ChatbotTab'>;
