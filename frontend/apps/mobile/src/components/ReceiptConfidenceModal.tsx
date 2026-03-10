import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface ConfidenceData {
  confidenceScore: number;
  warnings?: string[] | null;
  notes?: string[] | null;
  tax?: number | null;
  ocrTotal?: number | null;
}

interface ReceiptConfidenceModalProps {
  visible: boolean;
  onClose: () => void;
  data: ConfidenceData;
}

export function ReceiptConfidenceModal({
  visible,
  onClose,
  data,
}: ReceiptConfidenceModalProps) {
  const { confidenceScore, warnings, notes, tax, ocrTotal } = data;
  const hasWarnings = warnings && warnings.length > 0;
  const hasNotes = notes && notes.length > 0;
  const hasTax = tax != null && tax > 0;
  const hasTotal = ocrTotal != null && ocrTotal > 0;

  return (
    <Modal
      transparent
      animationType='fade'
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className='flex-1 bg-black/50 justify-center items-center px-6'
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View className='bg-card rounded-2xl p-6 w-80 max-h-[70vh]'>
            {/* Header */}
            <View className='flex-row items-center justify-between mb-4'>
              <Text className='text-foreground text-xl font-bold'>
                Scan Results
              </Text>
              <Pressable
                onPress={onClose}
                className='active:opacity-60 p-1'
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name='close'
                  size={20}
                  color='#6b7280'
                />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Confidence score */}
              <View className='flex-row justify-between items-center mb-4'>
                <Text className='text-foreground text-sm font-medium'>
                  Scan Confidence
                </Text>
                <Text
                  className='text-sm font-bold'
                  style={{
                    color:
                      confidenceScore >= 0.8
                        ? '#22c55e'
                        : confidenceScore >= 0.6
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                >
                  {Math.round(Math.max(0, Math.min(1, confidenceScore)) * 100)}%
                  {' — '}
                  {confidenceScore >= 0.8
                    ? 'Good'
                    : confidenceScore >= 0.6
                      ? 'Fair'
                      : 'Low'}
                </Text>
              </View>

              {/* OCR totals */}
              {(hasTax || hasTotal) && (
                <View className='bg-background rounded-xl p-3 mb-4 gap-1'>
                  {hasTotal && (
                    <View className='flex-row justify-between'>
                      <Text className='text-muted-foreground text-sm'>
                        Receipt Total
                      </Text>
                      <Text className='text-foreground text-sm font-medium'>
                        ${ocrTotal!.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {hasTax && (
                    <View className='flex-row justify-between'>
                      <Text className='text-muted-foreground text-sm'>
                        Tax Detected
                      </Text>
                      <Text className='text-foreground text-sm font-medium'>
                        ${tax!.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Warnings */}
              {hasWarnings && (
                <View className='mb-4'>
                  <Text className='text-foreground text-sm font-semibold mb-2'>
                    Warnings
                  </Text>
                  <View className='gap-2'>
                    {warnings!.map((w, i) => (
                      <View key={i} className='flex-row gap-2 items-start'>
                        <MaterialCommunityIcons
                          name='alert-circle-outline'
                          size={16}
                          color='#f59e0b'
                          style={{ marginTop: 1 }}
                        />
                        <Text className='text-muted-foreground text-sm flex-1'>
                          {w}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              {hasNotes && (
                <View className='mb-4'>
                  <Text className='text-foreground text-sm font-semibold mb-2'>
                    Notes
                  </Text>
                  <View className='gap-2'>
                    {notes!.map((n, i) => (
                      <View key={i} className='flex-row gap-2 items-start'>
                        <MaterialCommunityIcons
                          name='information-outline'
                          size={16}
                          color='#6b7280'
                          style={{ marginTop: 1 }}
                        />
                        <Text className='text-muted-foreground text-sm flex-1'>
                          {n}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!hasWarnings && !hasNotes && (
                <View className='flex-row gap-2 items-center mb-4'>
                  <MaterialCommunityIcons
                    name='check-circle-outline'
                    size={18}
                    color='#22c55e'
                  />
                  <Text className='text-muted-foreground text-sm'>
                    No issues detected with this receipt.
                  </Text>
                </View>
              )}
            </ScrollView>

            <Pressable
              className='bg-primary rounded-xl py-3 items-center mt-2 active:opacity-70'
              onPress={onClose}
            >
              <Text className='text-primary-foreground font-medium'>
                Got it
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
