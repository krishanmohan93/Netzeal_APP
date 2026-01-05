import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';

export default function MediaPickerScreen() {
  const [preview, setPreview] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.canceled) {
      setPreview(res.assets[0].uri);
      navigation.navigate('ImageEditor', { uri: res.assets[0].uri });
    }
  };

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.8 });
    if (!res.canceled) {
      navigation.navigate('ReelEditor', { uri: res.assets[0].uri });
    }
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    });
    if (res.assets && res.assets.length > 0) {
      const file = res.assets[0];
      navigation.navigate('UploadProgress', { type: 'document', file });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose media</Text>
      <View style={styles.row}>
        <TouchableOpacity onPress={pickImage} style={styles.btn}><Text>Pick Image</Text></TouchableOpacity>
        <TouchableOpacity onPress={pickVideo} style={styles.btn}><Text>Pick Video</Text></TouchableOpacity>
      </View>
      <TouchableOpacity onPress={pickDocument} style={[styles.btn, { marginTop: 12 }]}><Text>Pick Document</Text></TouchableOpacity>
      {preview && <Image source={{ uri: preview }} style={{ width: 200, height: 200, marginTop: 16, borderRadius: 8 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 }
});
