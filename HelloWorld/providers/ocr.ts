const analyzeReceipt = async (
  base64Image: Base64URLString,
): Promise<string[]> => {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_GOOGLE_URL as string);
    url.searchParams.set(
      'key',
      process.env.EXPO_PUBLIC_GOOGLE_API_KEY as string,
    );

    const body = {
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION' }],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.responses || !data.responses[0].textAnnotations) {
      return [];
    }

    const fullText = data.responses[0].textAnnotations[0].description;
    return fullText.split('\n');
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
};

export default analyzeReceipt;
