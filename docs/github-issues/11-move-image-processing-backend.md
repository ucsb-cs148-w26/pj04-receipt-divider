# Monorepo: Move Image Processing to Backend

## Description
Refactor image processing (OCR and AI parsing) to run entirely on the backend instead of the frontend. This will improve performance, reduce client-side complexity, secure API keys, and enable better error handling.

## Acceptance Criteria
- [ ] Create backend endpoint for receipt processing:
  - POST `/api/receipts/process` (or similar)
  - Accept image upload (multipart/form-data)
  - Handle large image files
- [ ] Move OCR logic to backend:
  - Move Google Cloud Vision integration to backend
  - Process image on server
  - Extract text from receipt
- [ ] Move AI parsing logic to backend:
  - Move OpenAI integration to backend
  - Parse items, prices, quantities
  - Clean and structure data
- [ ] Implement proper error handling:
  - Invalid image format
  - OCR failures
  - API rate limits
  - Timeout handling
- [ ] Remove frontend image processing dependencies:
  - Remove `@google-cloud/vision` from frontend
  - Remove `openai` from frontend
  - Update frontend package.json
- [ ] Update frontend to use new backend endpoint:
  - Upload image to backend
  - Display loading state
  - Handle response data
  - Show error messages
- [ ] Secure API keys:
  - Move all API keys to backend environment variables
  - Remove any API keys from frontend code
- [ ] Test end-to-end workflow:
  - Upload receipt image
  - Backend processes successfully
  - Frontend receives and displays results
- [ ] Add response caching if applicable
- [ ] Document API endpoint in backend README
- [ ] Update frontend documentation

## Priority
**High** - Improves security and performance

## Labels
`monorepo`, `backend`, `frontend`, `refactoring`, `security`, `performance`
