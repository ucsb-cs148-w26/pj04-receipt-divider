# Feature: Receipt Group Joining via Link/QR Code

## Description
Implement functionality to allow multiple users to join a receipt splitting session via a shareable link or QR code. This enables collaboration where friends can view the receipt and assign their own items.

## Acceptance Criteria
- [ ] Backend: Create link generation service:
  - POST `/api/receipts/{receipt_id}/share-link` endpoint
  - Generate unique, secure sharing links
  - Associate links with authenticated users (receipt host)
  - Set expiration time for links (configurable)
  - Store link metadata in database
- [ ] Backend: Create join receipt endpoint:
  - GET `/api/receipts/join/{share_token}` endpoint
  - Validate share token
  - Check expiration
  - Grant access to receipt data
  - Handle guest authentication (see guest auth requirement)
- [ ] Frontend: QR code generation:
  - Generate QR code from share link
  - Display QR code in UI
  - Allow host to share via QR code
  - Style QR code appropriately
- [ ] Frontend: Link sharing options:
  - Copy link to clipboard
  - Share via system share sheet (mobile)
  - Share via social media/messaging apps
- [ ] Frontend: Join receipt flow:
  - Scan QR code or click link
  - Navigate to receipt view
  - Display receipt details
  - Allow user to assign items to themselves
- [ ] Implement guest authentication:
  - Allow joining via mobile number (optional)
  - Store guest user info temporarily
  - Associate guest selections with phone number
- [ ] Security considerations:
  - Rate limiting on link generation
  - Prevent unauthorized access
  - Validate receipt ownership for link generation
- [ ] Test complete workflow:
  - Host creates receipt and generates link
  - Friend scans QR code or clicks link
  - Friend can view and interact with receipt
  - Changes sync properly
- [ ] Document API endpoints and usage

## Priority
**High** - Core feature for collaborative receipt splitting

## Labels
`feature`, `backend`, `frontend`, `qr-code`, `sharing`
