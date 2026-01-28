import { analyzeReceipt } from '../src/services/OcrService';

const handleUpload = async () => {
  if (!result.canceled) {
    try {
      const textLines = await analyzeReceipt(result.assets[0].base64);
      console.log(textLines);
    } catch (e) {
      console.error(e);
    }
  }
};

RESULTS in textLines