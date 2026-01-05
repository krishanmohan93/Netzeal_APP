import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, CameraType, FlashMode } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState<CameraType>(CameraType.back);
  const [flash, setFlash] = useState<FlashMode>(FlashMode.off);
  const [recording, setRecording] = useState(false);
  const cameraRef = useRef<Camera | null>(null);
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(status === 'granted' && mic.status === 'granted');
    })();
  }, []);

  const toggleCamera = () => setType((t) => (t === CameraType.back ? CameraType.front : CameraType.back));
  const toggleFlash = () => setFlash((f) => (f === FlashMode.off ? FlashMode.torch : FlashMode.off));

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
    navigation.navigate('ImageEditor', { uri: photo.uri });
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60, quality: '1080p' });
      navigation.navigate('ReelEditor', { uri: video.uri });
    } catch (e) {
      console.warn('Recording error', e);
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current) return;
    cameraRef.current.stopRecording();
  };

  if (hasPermission === null) return <View style={styles.center}><Text>Requesting camera permissions…</Text></View>;
  if (hasPermission === false) return <View style={styles.center}><Text>No access to camera</Text></View>;

  return (
    <View style={styles.container}>
      {isFocused && (
        <Camera ref={(r) => (cameraRef.current = r)} style={StyleSheet.absoluteFill} type={type} flashMode={flash} ratio="16:9" />
      )}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleFlash} style={styles.btn}><Text>Flash</Text></TouchableOpacity>
        {!recording ? (
          <TouchableOpacity onPress={startRecording} style={[styles.btn, styles.record]}><Text>Record</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={stopRecording} style={[styles.btn, styles.stop]}><Text>Stop</Text></TouchableOpacity>
        )}
        <TouchableOpacity onPress={takePhoto} style={styles.btn}><Text>Photo</Text></TouchableOpacity>
        <TouchableOpacity onPress={toggleCamera} style={styles.btn}><Text>Flip</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  controls: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly' },
  btn: { backgroundColor: '#ffffffcc', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24 },
  record: { backgroundColor: '#d32f2f' },
  stop: { backgroundColor: '#388e3c' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
