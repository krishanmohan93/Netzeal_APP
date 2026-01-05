import React, { useState, useRef } from 'react';
import { View, Image, FlatList, StyleSheet, TouchableOpacity, Dimensions, Modal, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing } from '../utils/theme';

const { width } = Dimensions.get('window');

const DOT_SIZE = 7;

const CarouselMedia = ({ mediaItems = [], onOpenFullscreen }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef({});

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index || 0;
      setActiveIndex(idx);
    }
  });

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const renderItem = ({ item, index }) => {
    const isVideo = item.media_type === 'VIDEO' || item.media_type === 'video';
    const isPdf = item.media_type === 'PDF' || item.media_type === 'pdf';
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => onOpenFullscreen && onOpenFullscreen(index)}>
        {isVideo ? (
          <Video
            ref={(r) => (videoRefs.current[index] = r)}
            source={{ uri: item.url }}
            style={styles.media}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={activeIndex === index}
          />
        ) : isPdf ? (
          <View style={[styles.media, styles.pdfContainer]}>
            <Icon name="document" size={48} color={colors.primary} />
            <Text style={styles.pdfText}>PDF</Text>
          </View>
        ) : (
          <Image source={{ uri: item.url }} style={styles.media} resizeMode="cover" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <FlatList
        horizontal
        pagingEnabled
        data={mediaItems}
        keyExtractor={(m) => m.id.toString()}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfigRef.current}
      />
      <View style={styles.dotsRow}>
        {mediaItems.map((_, i) => (
          <View
            key={i}
            testID="carousel-dot"
            style={[styles.dot, activeIndex === i && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 400,
    position: 'relative',
    backgroundColor: '#000'
  },
  media: {
    width,
    height: 400,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4
  },
  dotActive: {
    backgroundColor: '#FFF'
  },
  pdfContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  pdfText: {
    marginTop: 8,
    color: '#FFF'
  }
});

export default CarouselMedia;
