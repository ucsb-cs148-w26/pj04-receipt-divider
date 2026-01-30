import { analyzeReceipt } from "@/src/providers/OcrService";
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export default function CameraScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const mediaTypes: ImagePicker.MediaType[] = ["images"];
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes,
      quality: 1,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setExtractedText(null);

    const base64 = asset.base64;
    if (!base64) {
      setExtractedText("No base64 returned");
      return;
    }

    setIsLoading(true);
    const lines = await analyzeReceipt(base64);
    setExtractedText(lines.join("\n"));
    setIsLoading(false);
  };

  const goNext = () => {
    router.push({
      pathname: "../Receipt_Room_Page",
      params: {
        imageUri: imageUri ?? "",
        extractedText: extractedText ?? "",
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Take a Photo</Text>
        <Text style={styles.subtitle}>Use your camera to capture an image</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={openCamera} disabled={isLoading}>
          <Text style={styles.primaryText}>{isLoading ? "Processing..." : "Open Camera"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <View style={styles.previewCard}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <Text style={styles.uriText} numberOfLines={1}>
            {imageUri}
          </Text>
        </View>
      )}

      {extractedText && (
        <View style={styles.textCard}>
          <Text style={styles.textTitle}>OCR Text</Text>
          <Text style={styles.textBody} numberOfLines={10}>
            {extractedText}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.secondaryButton, !imageUri ? styles.disabledButton : null]}
        onPress={goNext}
        disabled={!imageUri}
      >
        <Text style={styles.secondaryText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    padding: 20,
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  secondaryText: {
    fontSize: 16,
    color: "#334155",
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  uriText: {
    fontSize: 12,
    color: "#64748B",
  },
  textCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
  },
  textTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#0F172A",
  },
  textBody: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
