import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRoute, useNavigation } from '@react-navigation/native';
import { uploadMedia } from '../services/mediaApi';

export default function ImageEditorScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { uri } = route.params || {};
  const [caption, setCaption] = useState('');
  const [processing, setProcessing] = useState(false);

  const cropSquare = async () => {
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(uri, [{ crop: { originX: 0, originY: 0, width: 1080, height: 1080 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      navigation.setParams({ uri: result.uri });
    } catch (e) {
      Alert.alert('Edit error', String(e));
    } finally {
      setProcessing(false);
    }
  };

  const publish = async () => {
    setProcessing(true);
    try {
      await uploadMedia({ fileUri: uri, caption, isReel: false });
      Alert.alert('Published', 'Your image post is live');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Upload error', String(e));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri }} style={styles.preview} />
      <View style={styles.row}>
        <TouchableOpacity onPress={cropSquare} style={styles.btn}><Text>Crop 1:1</Text></TouchableOpacity>
      </View>
      <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption" style={styles.input} />
      <TouchableOpacity disabled={processing} onPress={publish} style={[styles.btn, { backgroundColor: '#6a5acd' }]}>
        <Text style={{ color: '#fff' }}>{processing ? 'Publishing…' : 'Publish'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#000' },
  row: { flexDirection: 'row', gap: 12, marginVertical: 12 },
  btn: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 12 }
});
