import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { startLive, stopLive, postLiveComment, listActiveLives } from '../services/mediaApi';

export default function LiveStreamScreen() {
  const [session, setSession] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [active, setActive] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const liveList = await listActiveLives();
      setActive(liveList);
    })();
  }, []);

  const onStart = async () => {
    const s = await startLive({ title: 'Live from Netzeal', description: 'Say hi!' });
    setSession(s);
  };

  const onStop = async () => {
    if (!session) return;
    const s = await stopLive(session.id);
    setSession(s);
  };

  const sendComment = async () => {
    if (!session || !comment.trim()) return;
    await postLiveComment(session.id, comment.trim());
    setComment('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Streaming</Text>
      {!session ? (
        <TouchableOpacity onPress={onStart} style={styles.btn}><Text>Start Live</Text></TouchableOpacity>
      ) : (
        <>
          <Text>Session ID: {session.id}</Text>
          <Text>Stream Key: {session.stream_key}</Text>
          <TouchableOpacity onPress={onStop} style={[styles.btn, { backgroundColor: '#d32f2f' }]}><Text style={{ color: '#fff' }}>Stop</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TextInput value={comment} onChangeText={setComment} placeholder="Say something…" style={styles.input} />
            <TouchableOpacity onPress={sendComment} style={[styles.btn, { backgroundColor: '#6a5acd' }]}><Text style={{ color: '#fff' }}>Send</Text></TouchableOpacity>
          </View>
        </>
      )}

      <Text style={[styles.title, { marginTop: 24 }]}>Active Lives</Text>
      <FlatList data={active} keyExtractor={(i) => String(i.id)} renderItem={({ item }) => (
        <View style={styles.card}>
          <Text>Host: {item.host_user_id}</Text>
          <Text>Title: {item.title || 'Untitled'}</Text>
          <Text>Viewers: {item.viewer_count}</Text>
        </View>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  btn: { backgroundColor: '#eee', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  card: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12, marginBottom: 8 }
});
