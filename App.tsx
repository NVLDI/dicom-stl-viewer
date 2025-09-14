import React from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {  StyleSheet } from 'react-native';
import StlViewer from './src/screens/StlViewer'; // adjust path if needed
import PlyViewer from './src/screens/PlyViewer'; // adjust path if needed
import ObjViewer from './src/screens/ObjViewer';
export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <PlyViewer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
