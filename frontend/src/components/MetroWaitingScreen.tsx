import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function MetroWaitingScreen() {
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const id = setInterval(async () => {
      setAttempts((a) => a + 1);
      try {
        const res = await fetch('http://127.0.0.1:8081/status');
        if (res.ok) {
          // Metro reachable, reload RN app
          // @ts-ignore
          global?.ExpoModules?.Core?.reloadApp?.();
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Waiting for Metro…</Text>
      <Text style={styles.subtitle}>Attempt {attempts}. Ensure your computer and phone are on the same network.</Text>
      <Text style={styles.subtitle}>If on USB, run: adb reverse tcp:8081 tcp:8081</Text>
      <TouchableOpacity
        onPress={() => {
          // @ts-ignore
          global?.ExpoModules?.Core?.reloadApp?.();
        }}
        style={styles.btn}
      >
        <Text style={styles.btnText}>Retry Now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#101010' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitle: { color: '#aaa', marginTop: 8, textAlign: 'center' },
  btn: { marginTop: 16, backgroundColor: '#6a5acd', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  btnText: { color: '#fff', fontWeight: '600' }
});
