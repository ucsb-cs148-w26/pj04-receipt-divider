import { z } from 'zod';
import { randomUUID } from 'expo-crypto';
import OpenAI from 'openai';
import { ReceiptItemData } from '@shared/types';

interface RawReceiptItemData {
  name: string;
  price: string;
}

export class ErrorMessage {
  #message: string;
  constructor(message: string = '') {
    this.#message = message + "\n\n";
  }
  addMessage(newMessage: string) {
    this.#message += newMessage + '\n\n';
  }
  get message() {
    return this.#message;
  }
}

const RawReceiptItemDataSchema: z.ZodType<RawReceiptItemData> = z.object({
  name: z.string(),
  price: z.string(),
});

interface ExtractionEngine {
  extract(textBlocks: string[]): Promise<ReceiptItemData[] | ErrorMessage>;
}

class LLMEngine implements ExtractionEngine {
  model: string;
  readonly apiKey: string;
  readonly llmEndpoint: string;
  readonly llmClient: OpenAI;

  constructor() {
    this.model = process.env.EXPO_PUBLIC_LLM_MODEL as string;
    this.apiKey = process.env.EXPO_PUBLIC_LLM_KEY as string;
    this.llmEndpoint = process.env.EXPO_PUBLIC_LLM_URL as string;
    this.llmClient = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_LLM_KEY as string,
    });
  }

  async extract(textBlocks: string[]): Promise<ReceiptItemData[] | ErrorMessage> {
    const text = textBlocks.reduce((prev, curr) => prev + curr, '');
    const prompt = `Given the chunk of text identify receipt items and output them with the given format.\n# Format\nThe output as 'Results: <results>'.For example, 'Results: [{ "name": "carrot", "price": "$2.99" }, { "name": "water", "price": "$1.29" }]\nText: \n${text}`;
    return this.#transformQuery(await this.#query(prompt));
  }

  async #query(prompt: string): Promise<string | ErrorMessage> {
    let errorMessage: ErrorMessage = new ErrorMessage();
    try {
      const res = await fetch(this.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey} `,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        errorMessage.addMessage(`LLM HTTP error ${res.status} ${res.statusText} ${errorText}`.trim());
        throw new Error(
          `LLM HTTP error ${res.status} ${res.statusText} ${errorText}`.trim(),
        );
      }

      const response = await this.llmClient.responses.create({
        model: 'gpt-5-nano',
        input: prompt,
        store: false,
      });

      if (!response.output_text) {
        errorMessage.addMessage('LLM returned empty output');
        throw new Error('LLM returned empty output');
      }

      return response.output_text;
    } catch (error) {
      console.error('LLM request failed:', error);
      errorMessage.addMessage(`LLM request failed: ${error}`);
      return errorMessage;
    }
  }

  #transformQuery(res: string | ErrorMessage): ReceiptItemData[] | ErrorMessage {
    if (res instanceof ErrorMessage) {
      return res;
    }
    const captureClause: RegExp = /(?:Results:).*(\[.*\])/;
    const extractedText = captureClause.exec(res);

    if (!extractedText) {
      console.log("LLM didn't return proper format:\n");
      console.log(res);
      return new ErrorMessage("LLM didn't return proper format");
    }

    try {
      const ExtractedReceiptItemsSchema = z.array(RawReceiptItemDataSchema);
      const extractedItems = ExtractedReceiptItemsSchema.parse(
        JSON.parse(extractedText[1]),
      );

      return extractedItems.map((item) => {
        return {
          // FIXME: id should be randomUUID
          id: randomUUID(),
          name: item.name,
          price: item.price,
          userTags: [],
          discount: '',
        } as ReceiptItemData;
      });
    } catch (e) {
      console.log(e);
      return new ErrorMessage('LLM returned data in correct format but parsing failed: ' + e);
    }
  }
}

const analyzeReceipt = async (
  base64Image: Base64URLString,
): Promise<string[] | ErrorMessage> => {
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
      return new ErrorMessage("Google Vision API returned no response");
    }

    const fullText = data.responses[0].textAnnotations[0].description;
    return fullText.split('\n');
  } catch (error) {
    console.error('API Error:', error);
    return new ErrorMessage(`Google Vision API error: ${error}`);
  }
};

export const extractItems = async (
  base64ImageData: Base64URLString,
): Promise<ReceiptItemData[] | ErrorMessage> => {
  const textBlocks = await analyzeReceipt(base64ImageData);
  if (textBlocks instanceof ErrorMessage) {
    return textBlocks;
  }
  const engine = new LLMEngine();
  return await engine.extract(textBlocks);
};
