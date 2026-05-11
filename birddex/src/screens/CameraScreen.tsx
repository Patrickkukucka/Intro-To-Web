import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, radius, typography, rarityColors, shadows } from '../theme';
import { useStore } from '../store/useStore';
import { identifyBirdFromUri, inaturalistResultToBird, RARITY_FUN_FACTS } from '../services/iNaturalist';
import { Bird, INaturalistResult } from '../types';
import RarityBadge from '../components/RarityBadge';
import CatchAnimation from '../components/CatchAnimation';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Step = 'camera' | 'identifying' | 'result' | 'log';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('camera');
  const [results, setResults] = useState<INaturalistResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<INaturalistResult | null>(null);
  const [notes, setNotes] = useState('');
  const [logging, setLogging] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const navigation = useNavigation<Nav>();

  const { session, logSighting, profile, userBirds } = useStore();

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
    if (photo) {
      setCapturedUri(photo.uri);
      await identify(photo.uri);
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri);
      await identify(result.assets[0].uri);
    }
  }, []);

  const identify = async (uri: string) => {
    setStep('identifying');
    try {
      const identResults = await identifyBirdFromUri(uri);
      if (identResults.length === 0) {
        Alert.alert('No birds found', 'Could not identify a bird in this photo. Try a clearer shot!');
        setStep('camera');
        return;
      }
      setResults(identResults);
      setSelectedResult(identResults[0]);
      setStep('result');
    } catch {
      Alert.alert('Identification failed', 'Check your internet connection and try again.');
      setStep('camera');
    }
  };

  const handleLog = async () => {
    if (!selectedResult || !session?.user.id) return;
    const bird = inaturalistResultToBird(selectedResult);

    if (!profile?.isPro && userBirds.length >= 20 && !userBirds.some((ub) => ub.birdId === bird.id)) {
      navigation.navigate('ProUpgrade');
      return;
    }

    setLogging(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      let locationName: string | undefined;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          locationName = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
        }
      }

      const { limitReached } = await logSighting({
        userId: session.user.id,
        bird,
        photoUri: capturedUri ?? undefined,
        latitude,
        longitude,
        locationName,
        notes: notes.trim() || undefined,
      });

      if (limitReached) {
        navigation.navigate('ProUpgrade');
      }
    } finally {
      setLogging(false);
      reset();
    }
  };

  const reset = () => {
    setCapturedUri(null);
    setStep('camera');
    setResults([]);
    setSelectedResult(null);
    setNotes('');
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionEmoji}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            BirdDex needs camera access to identify birds.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'identifying') {
    return (
      <View style={styles.container}>
        {capturedUri && (
          <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} blurRadius={3} />
        )}
        <View style={styles.identifyingOverlay}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
          <Text style={styles.identifyingText}>Identifying bird...</Text>
          <Text style={styles.identifyingSubtext}>Powered by iNaturalist AI</Text>
        </View>
      </View>
    );
  }

  if (step === 'result' && selectedResult) {
    const bird = inaturalistResultToBird(selectedResult);
    const confidence = Math.round(selectedResult.combinedScore * 100);
    const isNew = !userBirds.some((ub) => ub.birdId === bird.id);

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.resultImageContainer}>
            {capturedUri && (
              <Image source={{ uri: capturedUri }} style={styles.resultImage} />
            )}
            <LinearGradient
              colors={['transparent', colors.background]}
              style={styles.resultImageGradient}
            />
            <TouchableOpacity style={styles.resultClose} onPress={reset}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            {isNew && (
              <View style={styles.newSpeciesBanner}>
                <Text style={styles.newSpeciesText}>✨ New Species!</Text>
              </View>
            )}
          </View>

          <View style={styles.resultContent}>
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{bird.commonName}</Text>
                <Text style={styles.resultScientific}>{bird.scientificName}</Text>
              </View>
              <RarityBadge rarity={bird.rarity} />
            </View>

            <View style={styles.confidenceBar}>
              <Text style={styles.confidenceLabel}>Match confidence</Text>
              <View style={styles.confidenceTrack}>
                <View style={[styles.confidenceFill, { width: `${confidence}%` }]} />
              </View>
              <Text style={styles.confidenceValue}>{confidence}%</Text>
            </View>

            {bird.funFacts?.[0] && (
              <View style={styles.funFactCard}>
                <Text style={styles.funFactTitle}>Fun Fact</Text>
                <Text style={styles.funFactText}>{bird.funFacts[0]}</Text>
              </View>
            )}

            <View style={styles.rarityFactCard}>
              <Text style={styles.rarityFactText}>{RARITY_FUN_FACTS[bird.rarity]}</Text>
            </View>

            {results.length > 1 && (
              <View style={styles.alternativesSection}>
                <Text style={styles.alternativesTitle}>Other possibilities</Text>
                {results.slice(1, 4).map((r, i) => {
                  const alt = inaturalistResultToBird(r);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.altRow, selectedResult === r && styles.altRowSelected]}
                      onPress={() => setSelectedResult(r)}
                    >
                      <Text style={styles.altName}>{alt.commonName}</Text>
                      <Text style={styles.altScore}>{Math.round(r.combinedScore * 100)}%</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TextInput
              style={styles.notesInput}
              placeholder="Add notes (optional)..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={styles.logBtn}
              onPress={handleLog}
              disabled={logging}
            >
              {logging ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.background} />
                  <Text style={styles.logBtnText}>Log Sighting</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <SafeAreaView style={styles.cameraUI} edges={['top', 'bottom']}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Identify Bird</Text>
            <TouchableOpacity
              style={styles.flipBtn}
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.cameraFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Text style={styles.cameraHint}>Center the bird in frame</Text>
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.libraryBtn} onPress={pickFromLibrary}>
              <Ionicons name="images-outline" size={26} color={colors.text} />
              <Text style={styles.libraryBtnText}>Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterBtn} onPress={takePicture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <View style={{ width: 64 }} />
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 24;
const cornerBase: object = {
  position: 'absolute',
  width: CORNER_SIZE,
  height: CORNER_SIZE,
  borderColor: colors.primaryLight,
  borderWidth: 3,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  cameraUI: { flex: 1, justifyContent: 'space-between' },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cameraTitle: { ...typography.h3, color: colors.text },
  flipBtn: {
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
  },
  cameraFrame: {
    width: 260,
    height: 260,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: cornerBase,
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  cameraHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: spacing.md,
  },
  libraryBtn: { alignItems: 'center', width: 64 },
  libraryBtnText: { ...typography.tiny, color: colors.text, marginTop: 4 },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.text,
  },

  // Permission
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  permissionEmoji: { fontSize: 64, marginBottom: spacing.lg },
  permissionTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  permissionText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  permissionBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  permissionBtnText: { ...typography.bodyBold, color: colors.text },

  // Identifying
  identifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  identifyingText: { ...typography.h3, color: colors.text },
  identifyingSubtext: { ...typography.caption, color: colors.textSecondary },

  // Result
  resultScroll: { paddingBottom: 40 },
  resultImageContainer: { height: 320, position: 'relative' },
  resultImage: { width: '100%', height: '100%' },
  resultImageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  resultClose: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.full,
    padding: spacing.sm,
  },
  newSpeciesBanner: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  newSpeciesText: { ...typography.bodyBold, color: colors.background },

  resultContent: { padding: spacing.lg },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.md },
  resultName: { ...typography.h2, color: colors.text },
  resultScientific: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },

  confidenceBar: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confidenceLabel: { ...typography.captionBold, color: colors.textSecondary, marginBottom: spacing.xs },
  confidenceTrack: { height: 6, backgroundColor: colors.surface, borderRadius: radius.full, overflow: 'hidden' },
  confidenceFill: { height: '100%', backgroundColor: colors.primaryLight, borderRadius: radius.full },
  confidenceValue: { ...typography.captionBold, color: colors.primaryLight, textAlign: 'right', marginTop: 4 },

  funFactCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  funFactTitle: { ...typography.captionBold, color: colors.primaryLight, marginBottom: spacing.xs },
  funFactText: { ...typography.body, color: colors.text, lineHeight: 20 },

  rarityFactCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rarityFactText: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },

  alternativesSection: { marginBottom: spacing.md },
  alternativesTitle: { ...typography.captionBold, color: colors.textSecondary, marginBottom: spacing.sm },
  altRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  altRowSelected: { borderColor: colors.primaryLight },
  altName: { ...typography.body, color: colors.text },
  altScore: { ...typography.captionBold, color: colors.primaryLight },

  notesInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: spacing.md,
  },
  logBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logBtnText: { ...typography.h4, color: colors.background },
});
