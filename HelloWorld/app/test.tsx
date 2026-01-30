
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { analyzeReceipt } from '../src/providers/OcrService';

export default function TestScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true, 
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      handleOcr(result.assets[0].base64);
    }
  };

  const handleOcr = async (base64Data: string | null | undefined) => {
    if (!base64Data) return;
    setLoading(true);
    setItems([]); 
    const result = await analyzeReceipt(base64Data);
    setItems(result);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* 去掉了大标题 */}
      
      <Button title="Upload Receipt" onPress={pickImage} />

      {loading && <ActivityIndicator size="large" color="#0000ff" style={{marginTop: 20}}/>}
      
      {image && <Image source={{ uri: image }} style={styles.preview} />}

      <ScrollView style={styles.list}>
        {/* 去掉了“识别结果”这行字 */}
        {items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>${item.price}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 60, padding: 20 },
  // 去掉了 title 和 subtitle 的样式
  preview: { width: 200, height: 300, resizeMode: 'contain', marginVertical: 20, borderWidth:1, borderColor:'#ddd' },
  list: { width: '100%', marginTop: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  itemName: { fontSize: 16 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: 'green' },
});