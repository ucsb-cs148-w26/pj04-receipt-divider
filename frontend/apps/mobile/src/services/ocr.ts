import { z } from 'zod';
import { randomUUID } from 'expo-crypto';
import OpenAI from 'openai';
import { ReceiptItemData } from '@shared/types';

interface RawReceiptItemData {
  name: string;
  price: string;
}

const FETCH_TIMEOUT_MS = 30000;
let hasLoggedEnv = false;

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = FETCH_TIMEOUT_MS,
  timeoutMessage: string = 'Operation timed out',
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export class ErrorMessage {
  #message: string;
  constructor(message: string = '') {
    this.#message = message + '\n\n';
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

  async extract(
    textBlocks: string[],
  ): Promise<ReceiptItemData[] | ErrorMessage> {
    const text = textBlocks.reduce((prev, curr) => prev + curr, '');
    const prompt = `Given the chunk of text identify receipt items and output them with the given format.\n# Format\nThe output as 'Results: <results>'.For example, 'Results: [{ "name": "carrot", "price": "$2.99" }, { "name": "water", "price": "$1.29" }]\nText: \n${text}`;
    return this.#transformQuery(await this.#query(prompt));
  }

  async #query(prompt: string): Promise<string | ErrorMessage> {
    let errorMessage: ErrorMessage = new ErrorMessage();
    try {
      const res = await fetchWithTimeout(this.llmEndpoint, {
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
        errorMessage.addMessage(
          `LLM HTTP error ${res.status} ${res.statusText} ${errorText}`.trim(),
        );
        throw new Error(
          `LLM HTTP error ${res.status} ${res.statusText} ${errorText}`.trim(),
        );
      }

      const response = await withTimeout(
        this.llmClient.responses.create({
          model: 'gpt-5-nano',
          input: prompt,
          store: false,
        }),
        FETCH_TIMEOUT_MS,
        'LLM response timed out',
      );

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

  #transformQuery(
    res: string | ErrorMessage,
  ): ReceiptItemData[] | ErrorMessage {
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
      return new ErrorMessage(
        'LLM returned data in correct format but parsing failed: ' + e,
      );
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
      return new ErrorMessage('Google Vision API returned no response');
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
  const errorMessage = new ErrorMessage();
  if (!hasLoggedEnv) {
    // Log resolved env vars once to help debug release builds.
    errorMessage.addMessage(`OCR env, {
      EXPO_PUBLIC_LLM_MODEL: ${process.env.EXPO_PUBLIC_LLM_MODEL},
      EXPO_PUBLIC_LLM_KEY: ${process.env.EXPO_PUBLIC_LLM_KEY ? '[set]' : '[missing]'},
      EXPO_PUBLIC_LLM_URL: ${process.env.EXPO_PUBLIC_LLM_URL},
      EXPO_PUBLIC_GOOGLE_URL: ${process.env.EXPO_PUBLIC_GOOGLE_URL},
      EXPO_PUBLIC_GOOGLE_API_KEY: ${process.env.EXPO_PUBLIC_GOOGLE_API_KEY ? '[set]' : '[missing]'},
    }`);
    hasLoggedEnv = true;
  }
  const textBlocks = await analyzeReceipt(base64ImageData);
  if (textBlocks instanceof ErrorMessage) {
    errorMessage.addMessage(textBlocks.message);
    return errorMessage;
  }
  const engine = new LLMEngine();
  const extractedItems = await engine.extract(textBlocks);
  if (extractedItems instanceof ErrorMessage) {
    errorMessage.addMessage(extractedItems.message);
    return errorMessage;
  }
  return extractedItems;
};
