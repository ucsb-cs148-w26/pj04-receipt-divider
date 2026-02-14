# Feature: Save Receipt Image for Reference

## Description
Store the original receipt image along with the processed data so users can reference the original receipt later. This provides verification and helps resolve disputes about items or prices.

## Acceptance Criteria
- [ ] Backend: Implement image storage:
  - Choose storage solution (Firebase Storage, Supabase Storage, S3, or Vercel Blob)
  - Create endpoint to upload receipt images
  - Generate unique filename/path for each image
  - Store reference to image in database with receipt data
  - Set appropriate access controls
- [ ] Backend: Image handling:
  - Validate image format and size
  - Compress/optimize images for storage
  - Generate thumbnail version (optional)
  - Handle upload failures gracefully
- [ ] Backend: Image retrieval:
  - Create endpoint to fetch receipt image
  - Implement signed URLs for security
  - Set appropriate cache headers
  - Handle not found cases
- [ ] Frontend: Display receipt image:
  - Show thumbnail in receipt list
  - Full-size image viewer in receipt detail
  - Zoom and pan capabilities
  - Download option
- [ ] Frontend: Image upload flow:
  - Upload image when processing receipt
  - Show upload progress
  - Handle upload errors
  - Retry mechanism if needed
- [ ] Privacy and security:
  - Only receipt participants can access image
  - Encrypt sensitive receipt data if needed
  - Set image retention policy
  - Allow user to delete image
- [ ] Performance considerations:
  - Lazy load images
  - Progressive image loading
  - Cache images appropriately
- [ ] Test image storage:
  - Upload various image formats and sizes
  - Retrieve and display images correctly
  - Verify access controls work
  - Test on slow networks
- [ ] Document image storage architecture
- [ ] Consider GDPR/privacy compliance for stored images

## Priority
**Medium** - Useful feature for verification

## Labels
`feature`, `backend`, `frontend`, `storage`, `images`
