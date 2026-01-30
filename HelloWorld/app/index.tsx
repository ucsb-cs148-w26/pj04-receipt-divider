// App.tsx
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { analyzeReceipt } from '../src/providers/OcrService'; // 引入你写的服务

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 选图功能
  const pickImage = async () => {
    // 弹窗请求相册权限
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // 选中图片后，立刻开始识别
      handleOcr(result.assets[0].uri);
    }
  };

  // 调用你的 OCR 逻辑
  const handleOcr = async (uri: string) => {
    setLoading(true);
    setItems([]); // 清空旧数据
    
    const result = await analyzeReceipt(uri);
    
    setItems(result);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧾 收据识别测试台</Text>
      
      <Button title="从相册选一张收据" onPress={pickImage} />

      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}

      {loading && <ActivityIndicator size="large" color="#0000ff" style={{marginTop: 20}}/>}
      
      <ScrollView style={styles.list}>
        {items.length > 0 && <Text style={styles.subtitle}>识别结果:</Text>}
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
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 80, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  preview: { width: 200, height: 300, resizeMode: 'contain', marginVertical: 20, borderWidth:1, borderColor:'#ddd' },
  list: { width: '100%', marginTop: 10 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  itemName: { fontSize: 16 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: 'green' },
});