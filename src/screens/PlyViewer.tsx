import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  useColorScheme,
  PanResponder,
} from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import * as DocumentPicker from 'expo-document-picker';

import { captureRef } from 'react-native-view-shot';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as FileSystemLegacy from 'expo-file-system/legacy';

export default function PlyViewer() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vertexCount, setVertexCount] = useState<number | null>(null);
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<THREE.Vector3 | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);

  const hasLoadedRef = useRef(false);
  const meshRef = useRef<THREE.Mesh>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const glRef = useRef<any>(null);
  const glViewWrapperRef = useRef(null);
  const lastPinch = useRef<number | null>(null);
  const colorScheme = useColorScheme();

  // Pan + Pinch controls
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
              Math.max(cam.position.z - (dist - lastPinch.current) * 0.05, 0.5),
              200
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

      // Compatible with both old + new API shapes
      if ('assets' in result && result.assets?.length) {
        const { uri, name } = result.assets[0];
        setFileUri(uri);
        setFileName(name || 'Unnamed.ply');
        hasLoadedRef.current = false;
      } else if ('uri' in result && result.uri) {
        setFileUri(result.uri);
        setFileName(result.name || 'Unnamed.ply');
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
    scene.background = new THREE.Color(colorScheme === 'dark' ? '#111' : '#fff');

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 0, 60);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    cameraRef.current = camera;

    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    try {
      setLoading(true);
      const plyText = await FileSystemLegacy.readAsStringAsync(fileUri, {
        encoding: 'utf8',
      });

      const { geometry, hasColors, vCount, fCount } = parsePlyAscii(plyText);
      setVertexCount(vCount);
      setFaceCount(fCount);

      const material = new THREE.MeshStandardMaterial({
        vertexColors: hasColors,
        color: hasColors ? undefined : 0x2194ce,
        wireframe,
        flatShading: false,
        side: THREE.DoubleSide,
        metalness: 0.0,
        roughness: 1.0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(0, 0, 0);
      meshRef.current = mesh;
      scene.add(mesh);

      // Scale + center model
      const box = new THREE.Box3().setFromObject(mesh);
      const sizeVec = new THREE.Vector3();
      box.getSize(sizeVec);
      setDimensions(sizeVec);

      const size = sizeVec.length();
      const scale = size > 0 ? 50 / size : 1;
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
      Alert.alert('PLY Load Error', err.message || 'Could not load file');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
     

      {!fileUri ? (
        <View style={styles.center}>
          <Text style={styles.info}>Upload a local .ply file to view</Text>
          <TouchableOpacity onPress={handlePickFile} disabled={loading} style={{ marginTop: 20 }}>
            {/* ✅ Explicit Ionicons usage */}
            <Ionicons name="folder-open-outline" size={30} color={loading ? '#ccc' : '#007bff'} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#2194ce" />
              <Text style={styles.info}>Loading PLY...</Text>
            </View>
          )}

          <View ref={glViewWrapperRef} collapsable={false} style={styles.viewer} {...panResponder.panHandlers}>
            <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
          </View>
           {(vertexCount !== null && faceCount !== null && dimensions) && (
        <View style={styles.infoBoxInline}>
          <Text style={styles.infoText}>
            Vertices: {vertexCount} | Faces: {faceCount}
          </Text>
          <Text style={styles.infoText}>
            W: {dimensions.x.toFixed(2)} | H: {dimensions.y.toFixed(2)} | D: {dimensions.z.toFixed(2)}
          </Text>
          {fileName && <Text style={styles.infoText}>Filename: {fileName}</Text>}
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
              } catch (err: any) {
                Alert.alert('Screenshot failed', err.message);
              }
            }} />
            <IconBtn icon="folder-open-outline" pack="ion" onPress={() => {
              setFileUri(null);
              setFileName(null);
              setVertexCount(null);
              setFaceCount(null);
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

function parsePlyAscii(plyText: string): {
  geometry: THREE.BufferGeometry;
  hasColors: boolean;
  vCount: number;
  fCount: number;
} {
  const lines = plyText.split('\n');
  let headerEnded = false;
  let vertexCount = 0;
  let faceCount = 0;
  let vertexProperties: string[] = [];

  let vertexLines: string[] = [];
  let faceLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!headerEnded) {
      if (line.startsWith('element vertex')) {
        vertexCount = parseInt(line.split(' ')[2], 10);
      } else if (line.startsWith('element face')) {
        faceCount = parseInt(line.split(' ')[2], 10);
      } else if (line.startsWith('property')) {
        vertexProperties.push(line);
      } else if (line === 'end_header') {
        headerEnded = true;
        vertexLines = lines.slice(i + 1, i + 1 + vertexCount);
        faceLines = lines.slice(i + 1 + vertexCount, i + 1 + vertexCount + faceCount);
        break;
      }
    }
  }

  const hasColors = vertexProperties.some(p => p.includes('red'));

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const line of vertexLines) {
    const parts = line.trim().split(/\s+/).map(Number);
    positions.push(parts[0], parts[1], parts[2]);
    if (hasColors && parts.length >= 6) {
      const r = parts[3] / 255;
      const g = parts[4] / 255;
      const b = parts[5] / 255;
      colors.push(r, g, b);
    }
  }

  for (const line of faceLines) {
    const parts = line.trim().split(/\s+/).map(Number);
    if (parts[0] === 3) {
      indices.push(parts[1], parts[2], parts[3]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (hasColors) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, hasColors, vCount: vertexCount, fCount: faceCount };
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

  infoText: { color: 'white', fontSize: 14, textAlign: 'center' },
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
  disabledBtn: { opacity: 0.6 },
});
