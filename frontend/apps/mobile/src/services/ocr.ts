// OCR is now handled entirely by the backend server via POST /group/receipt/add.
// All callers use addReceipt() from groupApi.ts, which uploads the image to the
// backend and receives parsed items through Supabase Realtime.
