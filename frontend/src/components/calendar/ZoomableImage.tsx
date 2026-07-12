import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  uri: string;
  width: number;
  height: number;
}

/**
 * Komponent obrazu z możliwością powiększania - taki sam jak w szybkim pomocniku.
 * - pinch = zoom (1x..5x)
 * - pan = przesuwanie po powiększeniu
 * - double tap = toggle zoom
 * - przyciski +/- do manualnego zoomu
 */
export function ZoomableImage({ uri, width, height }: Props) {
  const [displayScale, setDisplayScale] = useState(100);

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
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setDisplayScale(100);
  };

  const handleZoomIn = () => {
    const newScale = Math.min(scale.value + 0.5, 5);
    scale.value = withSpring(newScale);
    savedScale.value = newScale;
    setDisplayScale(Math.round(newScale * 100));
  };

  const handleZoomOut = () => {
    const newScale = Math.max(scale.value - 0.5, 1);
    scale.value = withSpring(newScale);
    savedScale.value = newScale;
    if (newScale === 1) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
    setDisplayScale(Math.round(newScale * 100));
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
      const centerX = width / 2;
      const centerY = height / 2;
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

      if (scale.value < 1) {
        runOnJS(resetZoom)();
      } else {
        const maxTranslateX = ((scale.value - 1) * width) / 2;
        const maxTranslateY = ((scale.value - 1) * height) / 2;

        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(Math.sign(translateX.value) * maxTranslateX);
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(Math.sign(translateY.value) * maxTranslateY);
        }
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTranslateX = ((scale.value - 1) * width) / 2;
        const maxTranslateY = ((scale.value - 1) * height) / 2;

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
      } else {
        const targetScale = 2.5;
        const centerX = width / 2;
        const centerY = height / 2;
        const offsetX = (event.x - centerX) * (targetScale - 1);
        const offsetY = (event.y - centerY) * (targetScale - 1);

        scale.value = withSpring(targetScale);
        translateX.value = withSpring(-offsetX);
        translateY.value = withSpring(-offsetY);
        savedScale.value = targetScale;
        savedTranslateX.value = -offsetX;
        savedTranslateY.value = -offsetY;
        runOnJS(updateDisplayScale)(targetScale);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Dla web - prosty widok bez gestów
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { width, height }]}>
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Dla natywnych platform - z gestami i przyciskami
  return (
    <View style={styles.wrapper}>
      <GestureHandlerRootView style={[styles.container, { width, height }]}>
        <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture)}>
          <Animated.View style={[styles.animatedContainer, { width, height }]}>
            <Animated.Image
              source={{ uri }}
              style={[{ width, height }, animatedStyle]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Przyciski zoom */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={[styles.zoomButton, displayScale <= 100 && styles.zoomButtonDisabled]}
          onPress={handleZoomOut}
          disabled={displayScale <= 100}
        >
          <Ionicons name="remove" size={24} color={displayScale <= 100 ? '#666' : '#FFF'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.scaleButton} onPress={resetZoom}>
          <Text style={styles.scaleText}>{displayScale}%</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.zoomButton, displayScale >= 500 && styles.zoomButtonDisabled]}
          onPress={handleZoomIn}
          disabled={displayScale >= 500}
        >
          <Ionicons name="add" size={24} color={displayScale >= 500 ? '#666' : '#FFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  animatedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  zoomButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonDisabled: {
    opacity: 0.4,
  },
  scaleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  scaleText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
