import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from './context/AuthContext';
import AuthWrapper from './components/AuthWrapper';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import InspectionDetailScreen from './screens/InspectionDetailScreen';

const Stack = createNativeStackNavigator();

const AuthStack = () => (
  <Stack.Navigator initialRouteName="Login">
    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator initialRouteName="Dashboard">
    <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerTitle: 'Samaj Drishti' }} />
    <Stack.Screen name="InspectionDetail" component={InspectionDetailScreen} options={{ headerTitle: 'Inspection Detail' }} />
  </Stack.Navigator>
);

const App = () => {
  return (
    <AuthProvider>
      <NavigationContainer>
        {/* Only one navigator is mounted at a time - previously both stacks
            rendered together, so the login screen never went away. */}
        <AuthWrapper authStack={<AuthStack />} appStack={<AppStack />} />
      </NavigationContainer>
    </AuthProvider>
  );
};

export default App;

