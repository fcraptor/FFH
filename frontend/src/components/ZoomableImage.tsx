import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ZoomableImageProps {
  uri: string;
  style?: any;
  title?: string;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({ uri, style, title: _title }) => {
  const [imageError, setImageError] = useState(false);
  const [displayScale, setDisplayScale] = useState(100);
  const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH - 32, height: 240 });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const updateDisplayScale = (newScale: number) => {
    setDisplayScale(Math.round(newScale * 100));
  };

  const resetZoom = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setDisplayScale(100);
  };

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const newScale = Math.min(Math.max(savedScale.value * event.scale, 1), 5);
      const centerX = imageSize.width / 2;
      const centerY = imageSize.height / 2;
      const scaleDiff = newScale - savedScale.value;
      const focalOffsetX = (focalX.value - centerX) * scaleDiff / savedScale.value;
      const focalOffsetY = (focalY.value - centerY) * scaleDiff / savedScale.value;

      scale.value = newScale;
      translateX.value = savedTranslateX.value - focalOffsetX;
      translateY.value = savedTranslateY.value - focalOffsetY;
      runOnJS(updateDisplayScale)(newScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      const maxTranslateX = ((scale.value - 1) * imageSize.width) / 2;
      const maxTranslateY = ((scale.value - 1) * imageSize.height) / 2;

      if (scale.value < 1) {
        runOnJS(resetZoom)();
        return;
      }

      if (Math.abs(translateX.value) > maxTranslateX) {
        translateX.value = withSpring(Math.sign(translateX.value) * maxTranslateX);
      }
      if (Math.abs(translateY.value) > maxTranslateY) {
        translateY.value = withSpring(Math.sign(translateY.value) * maxTranslateY);
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTranslateX = ((scale.value - 1) * imageSize.width) / 2;
        const maxTranslateY = ((scale.value - 1) * imageSize.height) / 2;

        translateX.value = Math.min(
          Math.max(savedTranslateX.value + event.translationX, -maxTranslateX),
          maxTranslateX
        );
        translateY.value = Math.min(
          Math.max(savedTranslateY.value + event.translationY, -maxTranslateY),
          maxTranslateY
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        runOnJS(resetZoom)();
        return;
      }

      const targetScale = 2.5;
      const centerX = imageSize.width / 2;
      const centerY = imageSize.height / 2;
      const offsetX = (event.x - centerX) * (targetScale - 1);
      const offsetY = (event.y - centerY) * (targetScale - 1);

      scale.value = withSpring(targetScale);
      translateX.value = withSpring(-offsetX);
      translateY.value = withSpring(-offsetY);
      savedScale.value = targetScale;
      savedTranslateX.value = -offsetX;
      savedTranslateY.value = -offsetY;
      runOnJS(updateDisplayScale)(targetScale);
    });

  const tapToResetGesture = Gesture.Tap().onEnd(() => {
    if (scale.value > 1) {
      runOnJS(resetZoom)();
    }
  });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, tapToResetGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (imageError) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Ionicons name="image-outline" size={48} color="#999" />
        <Text style={styles.errorText}>Nie można załadować obrazu</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.imageWrapper, style]}>
        <Image
          source={{ uri }}
          style={styles.zoomableImage}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
        <View style={styles.zoomHint}>
          <Ionicons name="expand-outline" size={16} color="#FFF" />
          <Text style={styles.zoomHintText}>Powiększ w aplikacji</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={composedGesture}>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setImageSize({ width, height });
            }
          }}
          style={[styles.imageWrapper, style]}
        >
          <Animated.Image
            source={{ uri }}
            style={[styles.zoomableImage, animatedStyle]}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
          <View style={styles.zoomHint}>
            <Ionicons name={displayScale > 100 ? 'refresh' : 'expand-outline'} size={16} color="#FFF" />
            <Text style={styles.zoomHintText}>
              {displayScale > 100 ? `Reset ${displayScale}%` : 'Powiększ palcami'}
            </Text>
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  imageWrapper: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    height: 240,
    overflow: 'hidden',
    width: '100%',
  },
  zoomableImage: {
    height: '100%',
    width: '100%',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  zoomHintText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 40,
    width: '100%',
    height: 240,
  },
  errorText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
});
