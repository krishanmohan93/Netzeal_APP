import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * Temporary local stub for uploadMedia to avoid missing-module compile errors.
 * Replace this with the real implementation that calls your backend or storage service.
 */
const uploadMedia = async ({
  fileUri,
  caption,
  isReel,
  trimStart,
  trimDuration,
}: {
  fileUri: string;
  caption?: string;
  isReel?: boolean;
  trimStart?: number;
  trimDuration?: number;
}): Promise<void> => {
  // Simulate upload latency; throw or return based on your needs.
  await new Promise((res) => setTimeout(res, 800));
  // For now we just resolve successfully. Implement actual upload logic here.
  return;
};

export default function ReelEditorScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { uri } = route.params || {};
  const [caption, setCaption] = useState('');
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(15);
  const [processing, setProcessing] = useState(false);

  const publishReel = async () => {
    setProcessing(true);
    try {
      await uploadMedia({ fileUri: uri, caption, isReel: true, trimStart: start, trimDuration: duration });
      Alert.alert('Published', 'Your reel is live');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Upload error', String(e));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Video source={{ uri }} style={styles.video} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping />
      <Text style={styles.label}>Trim Start: {start.toFixed(1)}s</Text>
      <Slider minimumValue={0} maximumValue={45} value={start} onValueChange={setStart} style={styles.slider} />
      <Text style={styles.label}>Duration: {duration.toFixed(1)}s</Text>
      <Slider minimumValue={5} maximumValue={60} value={duration} onValueChange={setDuration} style={styles.slider} />
      <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption" style={styles.input} />
      <TouchableOpacity disabled={processing} onPress={publishReel} style={[styles.btn, { backgroundColor: '#6a5acd' }]}>
        <Text style={{ color: '#fff' }}>{processing ? 'Publishing…' : 'Publish Reel'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  video: { width: '100%', height: 320, backgroundColor: '#000', borderRadius: 12 },
  label: { marginTop: 12, fontWeight: '500' },
  slider: { width: '100%', height: 40 },
  btn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 12 }
});
