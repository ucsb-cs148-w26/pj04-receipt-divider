// src/services/OcrService.js

export const analyzeReceipt = async (base64Image) => {
  const googleURL = new URL(process.env.GOOGLE_URL);
  googleURL.searchParams.set("key", process.env.GOOGLE_API_KEY);

  if (!base64Image) return [];

  try {
    console.log("Requesting Google Vision API...");
    const body = {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }],
      }],
    };

    const response = await fetch(googleURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!data.responses || !data.responses[0].textAnnotations) {
      return ["No text detected"];
    }

    // Get the full raw text
    const fullText = data.responses[0].textAnnotations[0].description;
    
    console.log("Raw Text:", fullText);

    // Split by new line to get a list of strings
    const allLines = fullText.split('\n');

    return allLines;

  } catch (error) {
    console.error("API Error:", error);
    return ["Error processing image"];
  }
};