import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, View, ScrollView, Pressable, Text, TouchableOpacity } from "react-native";
import { ReceiptItem, ReceiptItemType } from '@/components/Item';
import DisplayClaimedReceiptItem from '@/components/Display-Items'
 
const receiptItems: ReceiptItemType[]  = [ 
{id: 1, name: 'Burger', price: '12.99', userTags: [] }, 
{id: 2, name: 'Hamburger', price: '13.99', userTags: [1,2] },
{id: 3, name: 'Pizza', price: '13.99', userTags: [] },
{id: 4, name: 'Some Chinease Stuff', price: '11.99', userTags: [] },
{id: 5, name: 'Some Thigh Stuff', price: '11.98', userTags: [] },
{id: 6, name: 'Mysterious Meat', price: '930.99', userTags: [1,2,3,4,5,6,7,8,9,10] },
{id: 7, name: 'Egg Plant', price: '1.35', userTags: [1,2] },
{id: 8, name: '2 Egg Plants', price: '2.69', userTags: [1] },
{id: 9, name: '3 Egg Plants', price: '4.04', userTags: [1,2,3], discount: '0.04' },
{id: 10, name: 'Golden Egg', price: '2.99', userTags: [] },
{id: 11, name: 'The Elixir of Life', price: '1.99', userTags: [], discount: '1.00' },
{id: 12, name: 'Bacon', price: '2.00', userTags: [] },
{id: 30, name: 'Century Egg', price: '15.99', userTags: [], discount: '2.00'},
{id: 31, name: 'Super Ultra Duper Mega Giga Turbo Jumbo Wombo Shrimp', price: '16.99', userTags: [1,2,3], discount: '3.00'}, ];

let sumTotal: number = 0;
let currentDiscount: number = 0;
let currentPrice: number = 0;
let currentPercentage: number = 0;
let currentRemainder: number = 0;

// Distributes item prices amongst by the number of users who claimed them and calculates total
receiptItems.forEach(item => {
    if (item.userTags && item.userTags.length > 1) {
        currentPercentage = Math.floor((100 * 100) / item.userTags.length) / 100;
        currentRemainder = 100 - currentPercentage * item.userTags.length;
        /*
        if (item.userTags[item.userTags.length -1] === userPosition) {
            currentPercentage += currentRemainder;
        }
        else {
                currentPercentage = base;
            }
            userPosition is the index of the current user in the userTags array
        */
        currentPrice = (parseFloat(item.price)) * currentPercentage * .01;
        currentDiscount = (item.discount ? parseFloat(item.discount) : 0) * currentPercentage * .01;
        item.price = (currentPrice).toFixed(2);
        item.discount = (currentDiscount).toFixed(2); 
        sumTotal += currentPrice - currentDiscount;
    }
    else 
    {
        currentPrice = (parseFloat(item.price));
        currentDiscount = (item.discount ? parseFloat(item.discount) : 0);
        item.price = (currentPrice).toFixed(2);
        item.discount = (currentDiscount).toFixed(2); 
        sumTotal += currentPrice - currentDiscount;
    }
});



export default function YourItemScreen() {

  return (
    <View style={styles.container}>
        <View style={styles.backButton}>
            <TouchableOpacity
                onPress={() => router.back()}>
                <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        </View>

        <View style = {styles.scrollContainer}>
            <ScrollView
                    contentContainerStyle = {styles.scrollContent}>
                    {receiptItems.map((item) => (
                        <DisplayClaimedReceiptItem 
                        key={item.id}
                        id={item.id} 
                        name={item.name} 
                        price={item.price}
                        discount={item.discount}
                        percentage={item.userTags && item.userTags.length > 0 ? 100 / item.userTags.length : 100} />
                    ))}
            </ScrollView>
        
            <View style={styles.sumContainer}>
                <Text style={styles.sumContainerTextTotal}>Total</Text> 
            <Text style={styles.sumContainerText}>${sumTotal.toFixed(2)}</Text>
            </View>
        </View>
    </View>
    );
}

const styles = StyleSheet.create(
    {
        container: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            top: -10, // adjust as needed
        },
        scrollContainer: {
            flex: .8,
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
    }
);