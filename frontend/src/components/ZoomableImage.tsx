import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Modal,
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
const IMAGE_WIDTH = SCREEN_WIDTH - 32;
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.6;

interface ZoomableImageProps {
  uri: string;
  style?: any;
  title?: string;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({ uri, style, title }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [displayScale, setDisplayScale] = useState(100);

  // Shared values for animations
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Focal point for pinch zoom
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const updateDisplayScale = (newScale: number) => {
    setDisplayScale(Math.round(newScale * 100));
  };

  // Pinch gesture for zooming - with focal point support
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      // Store initial focal point
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      // Calculate new scale
      const newScale = Math.min(Math.max(savedScale.value * event.scale, 1), 5);
      
      // Calculate focal point offset from center
      const centerX = SCREEN_WIDTH / 2;
      const centerY = SCREEN_HEIGHT * 0.35; // Center of image area
      
      // Calculate how much the focal point moves due to scale change
      const scaleDiff = newScale - savedScale.value;
      const focalOffsetX = (focalX.value - centerX) * scaleDiff / savedScale.value;
      const focalOffsetY = (focalY.value - centerY) * scaleDiff / savedScale.value;
      
      // Apply scale and adjusted translation
      scale.value = newScale;
      translateX.value = savedTranslateX.value - focalOffsetX;
      translateY.value = savedTranslateY.value - focalOffsetY;
      
      runOnJS(updateDisplayScale)(newScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      // Reset if zoomed out too much
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(updateDisplayScale)(1);
      } else {
        // Clamp translation to bounds
        const maxTranslateX = ((scale.value - 1) * IMAGE_WIDTH) / 2;
        const maxTranslateY = ((scale.value - 1) * IMAGE_HEIGHT) / 2;
        
        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(Math.sign(translateX.value) * maxTranslateX);
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(Math.sign(translateY.value) * maxTranslateY);
        }
      }
    });

  // Pan gesture for moving when zoomed
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        const maxTranslateX = ((scale.value - 1) * IMAGE_WIDTH) / 2;
        const maxTranslateY = ((scale.value - 1) * IMAGE_HEIGHT) / 2;
        
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

  // Double tap to zoom at tap location
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        // Reset zoom
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(updateDisplayScale)(1);
      } else {
        // Zoom to tap location
        const targetScale = 2.5;
        const centerX = SCREEN_WIDTH / 2;
        const centerY = SCREEN_HEIGHT * 0.35;
        
        // Calculate offset to center the tap point
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

  // Combine gestures - pinch and pan work simultaneously
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const openModal = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setDisplayScale(100);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
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

  const handleReset = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setDisplayScale(100);
  };

  if (imageError) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Ionicons name="image-outline" size={48} color="#999" />
        <Text style={styles.errorText}>Nie można załadować obrazu</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={openModal} activeOpacity={0.8}>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri }}
            style={styles.thumbnail}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
          <View style={styles.zoomHint}>
            <Ionicons name="expand-outline" size={16} color="#FFF" />
            <Text style={styles.zoomHintText}>Powiększ</Text>
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <GestureHandlerRootView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            {title && (
              <Text style={styles.modalTitle} numberOfLines={1}>
                {title}
              </Text>
            )}
            <View style={styles.headerSpacer} />
          </View>

          {/* Zoomable Image */}
          <View style={styles.imageContainer}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={styles.animatedContainer}>
                <Animated.Image
                  source={{ uri }}
                  style={[styles.fullImage, animatedStyle]}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={[styles.zoomButton, displayScale <= 100 && styles.zoomButtonDisabled]}
              onPress={handleZoomOut}
              disabled={displayScale <= 100}
            >
              <Ionicons name="remove" size={28} color={displayScale <= 100 ? '#666' : '#FFF'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.scaleButton} onPress={handleReset}>
              <Text style={styles.scaleText}>{displayScale}%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.zoomButton, displayScale >= 500 && styles.zoomButtonDisabled]}
              onPress={handleZoomIn}
              disabled={displayScale >= 500}
            >
              <Ionicons name="add" size={28} color={displayScale >= 500 ? '#666' : '#FFF'} />
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <Text style={styles.instructions}>
            Rozsuń palce w miejscu które chcesz powiększyć
          </Text>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'relative',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    overflow: 'hidden',
    width: SCREEN_WIDTH - 64,
    height: 240,
    alignSelf: 'center',
  },
  thumbnail: {
    width: SCREEN_WIDTH - 64,
    height: 240,
    alignSelf: 'center',
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
    width: SCREEN_WIDTH - 64,
    height: 240,
  },
  errorText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 44,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  animatedContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  zoomButton: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonDisabled: {
    opacity: 0.4,
  },
  scaleButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  scaleText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  instructions: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
  },
});
