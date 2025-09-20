import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
  PanResponder,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { GLView } from 'expo-gl';
import { captureRef } from 'react-native-view-shot';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { parseSTL } from '../utils/parseSTL';

export default function StlViewer() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stlFormat, setStlFormat] = useState<'ascii' | 'binary' | null>(null);
  const [stlTriangleCount, setStlTriangleCount] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<THREE.Vector3 | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);

  const hasLoadedRef = useRef(false);
  const meshRef = useRef<THREE.Mesh>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const glRef = useRef(null);
  const glViewWrapperRef = useRef(null);
  const lastPinch = useRef<number | null>(null);
  const colorScheme = useColorScheme();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        const mesh = meshRef.current;
        const cam = cameraRef.current;
        if (!mesh || !cam) return;

        const touches = e.nativeEvent.touches;
        if (touches.length === 1) {
          mesh.rotation.y += gestureState.dx * 0.0015;
          mesh.rotation.x += gestureState.dy * 0.0015;
        } else if (touches.length === 2) {
          const [a, b] = touches;
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          if (lastPinch.current !== null) {
            cam.position.z = Math.min(
              Math.max(cam.position.z - (dist - lastPinch.current) * 0.05, 10),
              500
            );
          }
          lastPinch.current = dist;
        }
      },
      onPanResponderRelease: () => {
        lastPinch.current = null;
      },
    })
  ).current;

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setFileUri(uri);
        setFileName(result.assets[0].name || 'Unnamed.stl');
        hasLoadedRef.current = false;
      }
    } catch (err: any) {
      Alert.alert('File Picker Error', err.message || 'Something went wrong');
    }
  };

  const onContextCreate = async (gl: WebGLRenderingContext & { endFrameEXP: () => void }) => {
    if (hasLoadedRef.current || !fileUri) return;
    hasLoadedRef.current = true;

    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colorScheme === 'dark' ? '#111' : '#f0f0f0');

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 0, 60);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    cameraRef.current = camera;

    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);

    scene.add(new THREE.AmbientLight(0x404040, 1.5));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    try {
      setLoading(true);
      const response = await fetch(fileUri);
      const buffer = await response.arrayBuffer();
      const { geometry, format, triangleCount } = parseSTL(buffer);
      setStlFormat(format);
      setStlTriangleCount(triangleCount);

      const material = new THREE.MeshStandardMaterial({
        color: 0x6c757d,
        wireframe,
        metalness: 0.2,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(0, 0, 0);
      meshRef.current = mesh;
      scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      const sizeVec = new THREE.Vector3();
      box.getSize(sizeVec);
      setDimensions(sizeVec);

      const size = sizeVec.length();
      const scale = 50 / size;
      mesh.scale.setScalar(scale);
      mesh.position.sub(box.getCenter(new THREE.Vector3()));

      setLoading(false);
      glRef.current = gl;

      const animate = () => {
        requestAnimationFrame(animate);
        if (autoRotate && meshRef.current) {
          meshRef.current.rotation.y += 0.01;
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    } catch (err: any) {
      Alert.alert('STL Load Error', err.message || 'Could not load file');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!fileUri ? (
        <View style={styles.center}>
          <Text style={styles.info}>Upload a local .stl file to view</Text>
          <TouchableOpacity onPress={handlePickFile} disabled={loading} style={{ marginTop: 20 }}>
            <Ionicons name="folder-open-outline" size={30} color={loading ? '#ccc' : '#007bff'} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#6c757d" />
              <Text style={styles.info}>Loading STL...</Text>
            </View>
          )}

          <View ref={glViewWrapperRef} collapsable={false} style={styles.viewer} {...panResponder.panHandlers}>
            <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
          </View>
{(stlFormat && stlTriangleCount !== null && dimensions) && (
        <View style={styles.infoBoxInline}>
          <Text style={styles.infoText}>
            Format: {stlFormat.toUpperCase()} | Triangles: {stlTriangleCount}
          </Text>
          <Text style={styles.infoText}>
            W: {dimensions.x.toFixed(1)} | H: {dimensions.y.toFixed(1)} | D: {dimensions.z.toFixed(1)}
          </Text>
          {fileName && <Text style={styles.infoText}>Filename :{fileName}</Text>}
        </View>
      )}
          <View style={styles.iconBar}>
            <IconBtn icon="refresh-ccw" onPress={() => {
              if (cameraRef.current) {
                cameraRef.current.position.set(0, 0, 60);
                cameraRef.current.lookAt(new THREE.Vector3(0, 0, 0));
              }
            }} />
            <IconBtn icon={autoRotate ? 'pause' : 'play'} onPress={() => setAutoRotate(!autoRotate)} />
            <IconBtn icon="color-palette-outline" pack="ion" onPress={() => {
              if (meshRef.current) {
                const material = meshRef.current.material as THREE.MeshStandardMaterial;
                const newColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
                material.color.set(newColor);
              }
            }} />
            <IconBtn icon={wireframe ? 'eye-off' : 'eye'} onPress={() => {
              if (meshRef.current) {
                meshRef.current.material.wireframe = !meshRef.current.material.wireframe;
                setWireframe(!wireframe);
              }
            }} />
            <IconBtn icon="camera" onPress={async () => {
              try {
                const uri = await captureRef(glViewWrapperRef, {
                  format: 'png',
                  quality: 1,
                  result: 'tmpfile',
                });
                Alert.alert('📸 Screenshot saved', uri);
              } catch (err) {
                Alert.alert('Screenshot failed', err.message);
              }
            }} />
            <IconBtn icon="folder-open-outline" pack="ion" onPress={() => {
              setFileUri(null);
              setFileName(null);
              setStlFormat(null);
              setStlTriangleCount(null);
              setDimensions(null);
            }} disabled={loading} />
          </View>
        </>
      )}
    </View>
  );
}

function IconBtn({ icon, onPress, disabled = false, pack = 'feather' }) {
  const IconPack = pack === 'ion' ? Ionicons : pack === 'material' ? MaterialIcons : Feather;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.iconButton, disabled && styles.disabledBtn]} disabled={disabled}>
      <IconPack name={icon} size={22} color={disabled ? '#bbb' : '#4a5568'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  viewer: { flex: 1, marginVertical: 10, minHeight: 300 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  info: { color: '#6c757d', fontSize: 16, marginTop: 10, textAlign: 'center' },
  loader: {
    position: 'absolute',
    zIndex: 10,
    alignSelf: 'center',
    top: '45%',
    alignItems: 'center',
  },
  infoBoxInline: {
  marginTop: 0,
  padding: 3,
  borderRadius: 6,
  backgroundColor: '#222',
},
  infoText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  fileName: {
    fontSize: 12,
    color: '#adb5bd',
    alignSelf: 'center',
    marginTop: Platform.OS === 'ios' ? 90 : 70,
  },
  iconBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderColor: '#dee2e6',
  },
  iconButton: {
    backgroundColor: '#ffffff',
    padding: 10,
    marginHorizontal: 6,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
