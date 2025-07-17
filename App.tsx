import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import StlViewer from './src/screens/StlViewer'; // adjust path if needed

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StlViewer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
