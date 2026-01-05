// frontend/src/components/MediaPickerBottomSheet.js
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing, Dimensions, TouchableWithoutFeedback, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Camera } from 'expo-camera';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = 420;

const options = [
  {
    label: 'Choose Image',
    icon: <MaterialIcons name="photo-library" size={28} color="#4F8EF7" />,
    action: 'chooseImage',
  },
  {
    label: 'Choose Video',
    icon: <MaterialIcons name="video-library" size={28} color="#4F8EF7" />,
    action: 'chooseVideo',
  },
  {
    label: 'Choose Document',
    icon: <Ionicons name="document" size={28} color="#4F8EF7" />,
    action: 'chooseDocument',
  },
  {
    label: 'Click Photo',
    icon: <Ionicons name="camera" size={28} color="#4F8EF7" />,
    action: 'clickPhoto',
  },
  {
    label: 'Record Video',
    icon: <MaterialIcons name="videocam" size={28} color="#4F8EF7" />,
    action: 'recordVideo',
  },
  {
    label: 'Create Reel / Shorts',
    icon: <FontAwesome5 name="film" size={26} color="#4F8EF7" />,
    action: 'createReel',
  },
];

export default function MediaPickerBottomSheet({ visible, onClose, onMediaSelected, themeColor = '#4F8EF7' }) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraType, setCameraType] = useState(Camera.Constants.Type.back);
  const [cameraMode, setCameraMode] = useState('photo'); // 'photo' or 'video'
  const cameraRef = useRef(null);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: height - SHEET_HEIGHT,
        duration: 350,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        easing: Easing.in(Easing.exp),
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  const handleOption = async (action) => {
    try {
      if (action === 'chooseImage') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 1,
        });
        if (!result.canceled) onMediaSelected(result.assets);
        onClose();
      }
      if (action === 'chooseVideo') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 1,
        });
        if (!result.canceled) onMediaSelected(result.assets);
        onClose();
      }
      if (action === 'chooseDocument') {
        let result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (result.type !== 'cancel') onMediaSelected([result]);
        onClose();
      }
      if (action === 'clickPhoto') {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        setCameraMode('photo');
        setCameraVisible(true);
      }
      if (action === 'recordVideo') {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        setCameraMode('video');
        setCameraVisible(true);
      }
      if (action === 'createReel') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsMultipleSelection: true,
          selectionLimit: 10,
          aspect: [9, 16],
          quality: 1,
        });
        if (!result.canceled) onMediaSelected(result.assets);
        onClose();
      }
    } catch (e) {
      // Handle error
      onClose();
    }
  };

  const handleCameraCapture = async () => {
    if (cameraRef.current) {
      if (cameraMode === 'photo') {
        let photo = await cameraRef.current.takePictureAsync({ quality: 1 });
        onMediaSelected([photo]);
        setCameraVisible(false);
        onClose();
      } else if (cameraMode === 'video') {
        let video = await cameraRef.current.recordAsync({ quality: Camera.Constants.VideoQuality['480p'] });
        onMediaSelected([video]);
        setCameraVisible(false);
        onClose();
      }
    }
  };

  const handleCameraClose = () => {
    setCameraVisible(false);
    onClose();
  };

  return (
    <Modal
      visible={visible || cameraVisible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      {!cameraVisible ? (
        <Animated.View style={[styles.sheet, { top: slideAnim }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Media</Text>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.option, { borderColor: themeColor }]}
              onPress={() => handleOption(opt.action)}
              activeOpacity={0.8}
            >
              <View style={styles.icon}>{opt.icon}</View>
              <Text style={[styles.label, { color: themeColor }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <View style={styles.cameraContainer}>
          <Camera
            style={styles.camera}
            type={cameraType}
            ref={cameraRef}
            ratio="16:9"
          >
            <View style={styles.cameraControls}>
              <TouchableOpacity onPress={() => setCameraType(
                cameraType === Camera.Constants.Type.back
                  ? Camera.Constants.Type.front
                  : Camera.Constants.Type.back
              )}>
                <Ionicons name="camera-reverse" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.captureBtn}
                onPress={handleCameraCapture}
              >
                <View style={styles.innerCaptureBtn} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCameraClose}>
                <MaterialIcons name="close" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </Camera>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0008',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: SHEET_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    alignSelf: 'center',
    marginBottom: 18,
    color: '#222',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7faff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1.2,
  },
  icon: {
    marginRight: 18,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
    backgroundColor: '#f2f2f2',
  },
  cancelText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 36,
    backgroundColor: '#0006',
    paddingVertical: 16,
  },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff2',
  },
  innerCaptureBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
  },
});
