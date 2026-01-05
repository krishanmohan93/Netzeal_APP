import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { getAuthToken } from '../services/api';
import { API_BASE_URL } from '../config/environment';

const API_BASE = API_BASE_URL;

export async function uploadMedia({ fileUri, caption, isReel, trimStart, trimDuration, tags }: {
  fileUri: string;
  caption: string;
  isReel?: boolean;
  trimStart?: number;
  trimDuration?: number;
  tags?: string[];
}) {
  const token = await getAuthToken?.();
  const form = new FormData();
  form.append('caption', caption);
  if (isReel) form.append('is_reel', 'true');
  if (typeof trimStart === 'number') form.append('trim_start', String(trimStart));
  if (typeof trimDuration === 'number') form.append('trim_duration', String(trimDuration));
  if (tags && tags.length) form.append('tags', tags.join(','));

  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  const name = fileUri.split('/').pop() || 'upload';
  form.append('file', { uri: fileUri, name, type: getMimeType(name) } as any);

  const res = await axios.post(`${API_BASE}/content/upload-post`, form, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (p) => console.log('Upload', p.loaded / (p.total || 1))
  });
  return res.data;
}

export async function startLive({ title, description }: { title?: string; description?: string }) {
  const token = await getAuthToken?.();
  const res = await axios.post(`${API_BASE}/content/live/start`, { title, description }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function stopLive(sessionId: number) {
  const token = await getAuthToken?.();
  const res = await axios.post(`${API_BASE}/content/live/${sessionId}/stop`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function listActiveLives() {
  const res = await axios.get(`${API_BASE}/content/live/active`);
  return res.data;
}

export async function postLiveComment(sessionId: number, content: string) {
  const token = await getAuthToken?.();
  const res = await axios.post(`${API_BASE}/content/live/${sessionId}/comment`, { content }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

function getMimeType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    default: return 'application/octet-stream';
  }
}
