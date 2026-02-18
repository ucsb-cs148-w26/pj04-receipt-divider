import os
import re
import uuid
import json
from typing import List
import requests
from openai import OpenAI

from app.schemas.receipt import ReceiptItemData


class OCRService:
    # Service for extracting receipt items from images using OCR and LLM

    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.google_vision_url = os.getenv("GOOGLE_VISION_URL")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-5-nano")
        self.openai_client = OpenAI(api_key=self.openai_api_key)

    def analyze_receipt(self, base64_image: str) -> List[str]:
        # Extract text from image using Google Vision
        try:
            print(f"[OCR] Starting Google Cloud Vision API call...")
            print(f"[OCR] Image size: {len(base64_image)} characters")

            url = f"{self.google_vision_url}?key={self.google_api_key}"

            body = {
                "requests": [
                    {
                        "image": {"content": base64_image},
                        "features": [{"type": "TEXT_DETECTION"}],
                    }
                ]
            }

            response = requests.post(url, json=body, timeout=60)
            response.raise_for_status()
            print(f"[OCR] Google Cloud Vision API returned: {response.status_code}")

            data = response.json()

            # Check if text annotations exist
            if not data.get("responses") or not data["responses"][0].get(
                "textAnnotations"
            ):
                print("WARNING: No text annotations found in response")
                if data.get("responses") and data["responses"][0].get("error"):
                    print(f"Google Vision API Error: {data['responses'][0]['error']}")
                return []

            # Extract full text and split by newlines
            full_text = data["responses"][0]["textAnnotations"][0]["description"]
            return full_text.split("\n")

        except Exception as error:
            print(f"API Error: {error}")
            return []

    def extract_items(self, base64_image: str) -> List[ReceiptItemData]:
        # Extract receipt items from receipt image
        print(f"[OCR] Starting receipt extraction...")
        text_blocks = self.analyze_receipt(base64_image)
        print(f"[OCR] Extracted {len(text_blocks)} text blocks from image")

        items = self._parse_with_llm(text_blocks)
        print(f"[OCR] Parsed {len(items)} items from text")
        return items

    def _parse_with_llm(self, text_blocks: List[str]) -> List[ReceiptItemData]:
        # Parse text blocks intro structured receipt items

        # Combine text blocks
        text = "".join(text_blocks)

        # Prompt for LLM
        prompt = (
            "Given the chunk of text identify receipt items and output them with the given format.\n"
            "# Format\n"
            'The output as \'Results: <results>\'.For example, \'Results: [{ "name": "carrot", "price": "$2.99" }, '
            '{ "name": "water", "price": "$1.29" }]\n'
            f"Text: \n{text}"
        )

        # Query LLM
        llm_response = self._query_llm(prompt)

        # Transform and return
        return self._transform_response(llm_response)

    def _query_llm(self, prompt: str) -> str:
        # Query llm with request prompt and return a llm response
        print(f"[OCR] Calling OpenAI API with model: {self.openai_model}")

        response = self.openai_client.chat.completions.create(
            model=self.openai_model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            timeout=60,
        )

        print(f"[OCR] OpenAI API call completed")
        return response.choices[0].message.content or ""

    def _transform_response(self, response: str) -> List[ReceiptItemData]:
        # Extract JSON array from response using regex
        capture_pattern = r"(?:Results:).*(\[.*\])"
        match = re.search(capture_pattern, response)

        if not match:
            print("LLM didn't return proper format:")
            print(response)
            return []

        try:
            # Parse JSON
            extracted_items = json.loads(match.group(1))

            # Convert to ReceiptItemData objects
            items = []
            for item in extracted_items:
                items.append(
                    ReceiptItemData(
                        id=str(uuid.uuid4()),
                        name=item.get("name", ""),
                        price=item.get("price", ""),
                        userTags=[],
                        discount="",
                    )
                )

            return items

        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            return []
        except Exception as e:
            print(f"Error transforming response: {e}")
            return []
