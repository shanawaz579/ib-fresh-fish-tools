import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { BusinessConfigProvider } from './src/context/BusinessConfigContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <BusinessConfigProvider>
        <AppNavigator />
      </BusinessConfigProvider>
    </AuthProvider>
  );
}
