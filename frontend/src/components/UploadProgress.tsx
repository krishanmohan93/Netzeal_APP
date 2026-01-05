import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UploadProgress({ progress, label = 'Uploading…' }: { progress: number; label?: string }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.percent}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', paddingVertical: 8 },
  label: { marginBottom: 6, color: '#555' },
  bar: { height: 10, backgroundColor: '#eee', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#6a5acd' },
  percent: { marginTop: 6, fontWeight: '600' }
});
