import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Button,
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Text,
  TouchableOpacity,
} from 'react-native';
import { ReceiptItem, ReceiptItemType } from '@/components/Item';
import DisplayClaimedReceiptItem from '@/components/Display-Items';

export type YourItemsRoomParams = {
  roomId: string;
  items: string;
  participantId: string;
};

export default function YourItemScreen() {
  const params = useLocalSearchParams<YourItemsRoomParams>();
  const participantId = parseInt(params.participantId);
  const receiptItems = JSON.parse(params.items) as ReceiptItemType[];
  let totalSum = 0;

  function calculatePrices() {
    // Logic to calculate prices for the participant// Distributes item prices amongst by the number of users who claimed them and calculates total
    receiptItems.forEach((item) => {
      const itemPrice = isNaN(parseFloat(item.price))
        ? 0
        : parseFloat(item.price);

      if (item.userTags && item.userTags.length > 1) {
        const currentPercentage = 100 / item.userTags.length;
        let roundedPrice = Math.floor(itemPrice * currentPercentage) / 100;

        const remainderTimes100 = Math.trunc(
          (parseFloat(item.price) - roundedPrice * item.userTags.length) * 100,
        );
        console.log(
          'Rounded Price: ' + roundedPrice,
          'Item name: ' + item.name,
          'Participant ID: ' + participantId,
          'Remainder: ' + remainderTimes100,
        );
        if (participantId > item.userTags.length - remainderTimes100) {
          roundedPrice += 0.01;
        }

        const currentDiscount =
          (item.discount ? parseFloat(item.discount) : 0) *
          currentPercentage *
          0.01;
        item.price = roundedPrice.toFixed(2);
        item.discount = currentDiscount.toFixed(2);
        totalSum += roundedPrice - currentDiscount;
      } else {
        const currentPrice = itemPrice;
        const currentDiscount = item.discount ? parseFloat(item.discount) : 0;
        item.price = currentPrice.toFixed(2);
        item.discount = currentDiscount.toFixed(2);
        totalSum += currentPrice - currentDiscount;
      }
    });
  }
  calculatePrices();

  return (
    <View style={styles.container}>
      <View style={styles.backButton}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scrollContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {receiptItems.map((item) => (
            <DisplayClaimedReceiptItem
              key={item.id}
              id={item.id}
              name={item.name}
              price={item.price}
              discount={item.discount}
              percentage={
                item.userTags && item.userTags.length > 0
                  ? 100 / item.userTags.length
                  : 100
              }
            />
          ))}
        </ScrollView>

        <View style={styles.sumContainer}>
          <Text style={styles.sumContainerTextTotal}>Total</Text>
          <Text style={styles.sumContainerText}>${totalSum.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -10, // adjust as needed
  },
  scrollContainer: {
    flex: 0.8,
    bottom: -10,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  backButton: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: 50,
    bottom: 10,
  },
  backButtonText: {
    fontSize: 20,
    color: 'black',
  },
  sumContainer: {
    color: 'rgb(255, 255, 255)',
    borderColor: 'rgba(0,0,0,.25)',
    borderTopWidth: 1,
    paddingTop: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    bottom: -30,
    marginTop: 8,
  },
  sumContainerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  sumContainerTextTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
});
