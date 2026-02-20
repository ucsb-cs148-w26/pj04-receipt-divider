import React from 'react';
import { useTheme } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeThemeColorType } from '@shared/types/native-theme';

export interface DisplayClaimedReceiptItemProps {
  id: string;
  name: string;
  price: string;
  discount?: string; // Optional discount amount
  percentage?: number; // Percentage of the item claimed by the user
}

export function DisplayItems({
  id,
  name,
  price,
  discount,
  percentage,
}: DisplayClaimedReceiptItemProps) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => createStyles(colors, dark), [colors, dark]);
  const [showDiscount, setShowDiscount] = useState(
    !!discount && parseFloat(discount) > 0,
  );
  return (
    <View style={[styles.container]}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.percentText}>
            {Math.round(percentage || 100)}%
          </Text>
        </View>
        {/* Name Section - left justified*/}
        <View style={styles.leftSection}>
          <View style={styles.nameContainer}>
            {<Text style={styles.nameText}>{name}</Text>}
          </View>
        </View>

        {/* Price - right justified */}
        <View style={styles.rightSection}>
          <View style={styles.priceContainer}>
            {
              <View style={styles.priceInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <Text style={styles.priceText}>{price}</Text>
              </View>
            }
          </View>
        </View>
      </View>

      {/* Discount section - lower right justified */}
      {showDiscount && (
        <View style={styles.discountText}>
          <Text style={styles.discountLabel}>Discount:</Text>
          <Text style={styles.discountDollar}>$</Text>
          <Text style={styles.discountText}>{discount}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: NativeThemeColorType, dark: boolean) =>
  StyleSheet.create({
    container: {
      minWidth: '100%',
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 24,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    gripIcon: {
      color: colors.text,
      fontSize: 20,
    },
    nameContainer: {
      flex: 1,
      minWidth: 0,
    },
    nameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 8,
      color: colors.text,
    },
    nameText: {
      color: colors.text,
    },
    rightSection: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      gap: 8,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    priceInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    dollarSign: {
      color: colors.text,
      fontWeight: 'bold',
    },
    priceInput: {
      width: 80,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 8,
      color: colors.text,
      fontWeight: 'bold',
      textAlign: 'right',
    },
    priceText: {
      color: colors.text,
      fontWeight: 'bold',
    },
    discountText: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    discountLabel: {
      fontSize: 12,
      color: colors.text,
    },
    discountDollar: {
      color: colors.text,
      fontSize: 14,
    },
    discountInput: {
      width: 64,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 8,
      color: colors.text,
      fontSize: 14,
      textAlign: 'right',
    },
    badge: {
      backgroundColor: '#E5E7EB', // light grey
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 70,
    },
    percentText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#111827',
      lineHeight: 14,
    },
    amountText: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '600',
      color: '#374151',
      lineHeight: 14,
    },
  });
