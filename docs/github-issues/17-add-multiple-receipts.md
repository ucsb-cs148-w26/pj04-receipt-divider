# Feature: Add Multiple Receipts

## Description
Allow users to add multiple receipts to a single splitting session. This enables scenarios where friends shop together at multiple stores or want to combine several purchases into one settlement.

## Acceptance Criteria
- [ ] Backend: Update data model:
  - Support multiple receipts per session/group
  - Link receipts to a parent session/group
  - Store receipt metadata (store name, date, total)
  - Maintain separate item lists per receipt
- [ ] Backend: Create session management:
  - Create receipt group/session endpoint
  - Add receipt to existing session
  - List all receipts in session
  - Calculate combined totals across receipts
- [ ] Frontend: Session UI:
  - Create new splitting session
  - Add multiple receipts to session
  - View list of receipts in session
  - Navigate between receipts
  - Show combined totals
- [ ] Frontend: Receipt management:
  - Upload new receipt to session
  - Remove receipt from session
  - Edit individual receipts
  - Assign items across multiple receipts
- [ ] Calculation logic:
  - Calculate totals per receipt
  - Calculate combined total per person across all receipts
  - Handle taxes across multiple receipts
  - Show breakdown by receipt
- [ ] Sharing functionality:
  - Share entire session (all receipts)
  - Share individual receipt
  - QR code for session access
- [ ] User experience:
  - Clear visual distinction between receipts
  - Easy navigation between receipts
  - Summary view of all receipts
  - Person's items across all receipts
- [ ] Test multiple receipts:
  - Add 2-5 receipts to session
  - Assign items across receipts
  - Verify totals are correct
  - Test sharing session
  - Verify real-time sync with multiple receipts
- [ ] Handle edge cases:
  - Maximum number of receipts per session
  - Empty receipts
  - Deleting receipts with assigned items
- [ ] Document multi-receipt functionality

## Priority
**Medium** - Nice-to-have feature for advanced use cases

## Labels
`feature`, `backend`, `frontend`, `enhancement`, `receipts`
