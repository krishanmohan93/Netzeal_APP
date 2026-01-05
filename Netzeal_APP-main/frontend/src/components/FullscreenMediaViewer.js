import React, { useState, useRef } from 'react';
import { Modal, View, StyleSheet, Dimensions, TouchableOpacity, Text, FlatList, Image } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import ZoomableImage from './ZoomableImage';
import { colors, spacing } from '../utils/theme';

const { width, height } = Dimensions.get('window');

const FullscreenMediaViewer = ({ visible, mediaItems = [], startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const listRef = useRef(null);
  const videoRefs = useRef({});

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index || 0;
      setIndex(idx);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const renderItem = ({ item, index: itemIndex }) => {
    const isVideo = item.media_type === 'VIDEO' || item.media_type === 'video';
    const isPdf = item.media_type === 'PDF' || item.media_type === 'pdf';
    if (isVideo) {
      return (
        <Video
          ref={(r) => (videoRefs.current[itemIndex] = r)}
            source={{ uri: item.url }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            shouldPlay={index === itemIndex}
          />
      );
    }
    if (isPdf) {
      return (
        <View style={[styles.media, styles.pdfContainer]}>
          <Icon name="document" size={64} color={colors.primary} />
          <Text style={styles.pdfText}>PDF Document</Text>
        </View>
      );
    }
    return <ZoomableImage uri={item.url} style={styles.media} />;
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={mediaItems}
          keyExtractor={(m) => m.id.toString()}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewConfigRef.current}
          initialScrollIndex={startIndex}
          getItemLayout={(data, i) => ({ length: width, offset: width * i, index: i })}
        />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Icon name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.counterText}>{index + 1}/{mediaItems.length}</Text>
        </View>
        <View style={styles.dotsRow}>
          {mediaItems.map((_, i) => (
            <View key={i} style={[styles.dot, index === i && styles.dotActive]} />
          ))}
        </View>
      </View>
    </Modal>
  );
};

const DOT = 7;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  media: { width, height, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md
  },
  closeBtn: { padding: spacing.sm },
  counterText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dotsRow: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT/2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  dotActive: { backgroundColor: '#fff' },
  pdfContainer: { justifyContent: 'center', alignItems: 'center' },
  pdfText: { marginTop: 12, color: '#fff' }
});

export default FullscreenMediaViewer;
