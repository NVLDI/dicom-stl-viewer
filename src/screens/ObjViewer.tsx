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
import { OBJLoader } from 'three-stdlib/loaders/OBJLoader';
import { MTLLoader } from 'three-stdlib/loaders/MTLLoader';

export default function ObjViewer() {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState<THREE.Vector3 | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);

  const hasLoadedRef = useRef(false);
  const meshRef = useRef<THREE.Object3D>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
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
              Math.max(cam.position.z - (dist - lastPinch.current) * 0.05, 1),
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
        setFileName(result.assets[0].name || 'Unnamed.obj');
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

      // Load OBJ and possible MTL
      const response = await fetch(fileUri);
      const objText = await response.text();

      let object: THREE.Object3D;

      // Try to find a matching .mtl
      const basePath = fileUri.substring(0, fileUri.lastIndexOf('/'));
      const mtlUri = fileUri.replace(/\.obj$/i, '.mtl');

      try {
        const mtlResponse = await fetch(mtlUri);
        if (mtlResponse.ok) {
          const mtlText = await mtlResponse.text();
          const mtlLoader = new MTLLoader();
          const materials = mtlLoader.parse(mtlText, basePath);
          materials.preload();

          const loader = new OBJLoader();
          loader.setMaterials(materials);
          object = loader.parse(objText);
        } else {
          const loader = new OBJLoader();
          object = loader.parse(objText);
        }
      } catch {
        const loader = new OBJLoader();
        object = loader.parse(objText);
      }

      meshRef.current = object;
      scene.add(object);

      // Center + scale
      const box = new THREE.Box3().setFromObject(object);
      const sizeVec = new THREE.Vector3();
      box.getSize(sizeVec);
      setDimensions(sizeVec);

      const size = sizeVec.length();
      const scale = size > 0 ? 50 / size : 1;
      object.scale.setScalar(scale);
      object.position.sub(box.getCenter(new THREE.Vector3()));

      setLoading(false);

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
      Alert.alert('OBJ Load Error', err.message || 'Could not load file');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      

      {!fileUri ? (
        <View style={styles.center}>
          <Text style={styles.info}>Upload a local .obj file to view</Text>
          <TouchableOpacity onPress={handlePickFile} disabled={loading} style={{ marginTop: 20 }}>
            <Ionicons name="folder-open-outline" size={30} color={loading ? '#ccc' : '#007bff'} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#6c757d" />
              <Text style={styles.info}>Loading OBJ...</Text>
            </View>
          )}

          <View ref={glViewWrapperRef} collapsable={false} style={styles.viewer} {...panResponder.panHandlers}>
            <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
          </View>
{dimensions && (
        <View style={styles.infoBoxInline}>
          <Text style={styles.infoText}>
            W: {dimensions.x.toFixed(2)} | H: {dimensions.y.toFixed(2)} | D: {dimensions.z.toFixed(2)}
          </Text>
          {fileName && <Text style={styles.infoText}>Filename: {fileName}</Text>}
        </View>
      )}
          <View style={styles.iconBar}>
            <IconBtn icon="refresh-ccw" onPress={() => {
              if (cameraRef.current && meshRef.current) {
                fitCameraToObject(cameraRef.current, meshRef.current);
              }
            }} />
            <IconBtn icon={autoRotate ? 'pause' : 'play'} onPress={() => setAutoRotate(!autoRotate)} />
            <IconBtn icon="color-palette-outline" pack="ion" onPress={() => {
              if (meshRef.current) {
                meshRef.current.traverse((child: any) => {
                  if (child.isMesh) {
                    const material = child.material as THREE.MeshStandardMaterial;
                    const newColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
                    material.color.set(newColor);
                  }
                });
              }
            }} />
            <IconBtn icon={wireframe ? 'eye-off' : 'eye'} onPress={() => {
              if (meshRef.current) {
                meshRef.current.traverse((child: any) => {
                  if (child.isMesh) {
                    child.material.wireframe = !child.material.wireframe;
                  }
                });
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

function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));

  cameraZ *= 1.5; // padding
  camera.position.set(center.x, center.y, cameraZ);
  camera.lookAt(center);

  camera.near = cameraZ / 100;
  camera.far = cameraZ * 100;
  camera.updateProjectionMatrix();
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
