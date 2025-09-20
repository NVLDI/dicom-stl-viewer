import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import StlViewer from './src/screens/StlViewer';
import PlyViewer from './src/screens/PlyViewer';
import ObjViewer from './src/screens/ObjViewer';

export default function App() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>3D Viewers</Text>
        
        <View style={styles.viewerContainer}>
          <Text style={styles.label}>STL Viewer</Text>
          <StlViewer />
        </View>

        <View style={styles.viewerContainer}>
          <Text style={styles.label}>PLY Viewer</Text>
          <PlyViewer />
        </View>

        <View style={styles.viewerContainer}>
          <Text style={styles.label}>OBJ Viewer</Text>
          <ObjViewer />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  scroll: {
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  viewerContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  label: {
    padding: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#333',
    textAlign: 'center',
  },
});
