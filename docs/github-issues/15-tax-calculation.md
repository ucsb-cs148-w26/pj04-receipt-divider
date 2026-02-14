# Feature: Tax Calculation

## Description
Implement automatic tax calculation and distribution across receipt items. The system should identify tax amounts from the receipt, calculate proportional tax for each item, and include it in individual totals.

## Acceptance Criteria
- [ ] OCR/AI: Extract tax information:
  - Identify tax line items on receipt
  - Extract tax amount
  - Differentiate between different tax types (sales tax, VAT, etc.)
  - Handle multiple tax rates if applicable
- [ ] Backend: Tax calculation service:
  - Calculate proportional tax per item based on subtotal
  - Formula: `item_tax = (item_price / subtotal) * total_tax`
  - Handle rounding appropriately
  - Support different tax calculation methods
- [ ] Backend: Store tax information:
  - Tax amount per receipt
  - Tax rate (if extractable)
  - Tax per item (calculated)
  - Include in receipt data model
- [ ] Frontend: Display tax information:
  - Show total tax on receipt
  - Show tax per item (optional detail view)
  - Include tax in person's total
  - Clear breakdown of costs (subtotal + tax = total)
- [ ] Handle edge cases:
  - No tax on receipt (tax-free items)
  - Tax-exempt items
  - Tip vs tax distinction
  - Pre-tax vs post-tax receipts
- [ ] Support manual tax adjustment:
  - Allow user to edit tax amount if OCR incorrect
  - Recalculate item taxes when adjusted
- [ ] Test tax calculations:
  - Verify accuracy with sample receipts
  - Check rounding errors are minimal
  - Test with various tax rates
  - Ensure totals match receipt total
- [ ] Document tax calculation logic
- [ ] Consider regional tax differences (US, EU, etc.)

## Priority
**Medium** - Important for accurate cost splitting

## Labels
`feature`, `backend`, `frontend`, `calculation`, `tax`
