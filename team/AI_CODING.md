## Roy - Gemini

### Issue
A topic that my team discussed was the issue of tax and how we should implement the tax splitting. Not all items are taxed the same, and there is no universal tax rate that we could use to calculate the tax per item. So, what is the best way to deal with taxes?

### Outcomes
For my initial prompt, Gemini produced these ideas:
1. OCR scans receipt.
2. App attempts to identify taxable keywords (Alcohol, General Merchandise, Cleaning) and auto-flags them.
3. User reviews and taps the toggle on any items the app missed.
4. App calculates the tax rate based only on flagged items and distributes the cost.

However, this approach runs into the problem of unfair tax splits. If person A buys an item with tax rate 5% and person B buys an item with tax rate 10%, then person A would end up paying more.

To accomodate for this issue, Gemini proposed a bucket approach:
- Bucket A (Standard): General merchandise, restaurant food.
- Bucket B (Special/High): Alcohol, luxury goods, sugary drinks.
- Bucket C (Zero/Exempt): Raw groceries, gift cards, essential medicine.

With these buckets, the algorithm would be:
- Input: User (or OCR) inputs the total tax amount for each bucket found on the receipt (e.g., "Tax: $5.00", "Liquor Tax: $2.00").
- Tagging: Every item is linked to a specific tax_bucket_id.
- Calculation: The system calculates a unique Effective Rate for each bucket.
    - Example: If the "Liquor Tax" is $2.00 and the total price of all liquor items is $20.00, the effective rate for that bucket is 10%.
- Distribution: When a user claims an item, they inherit the tax rate of that item's bucket.

### Reflections
- In my opinion, this tool was pretty useful for providing possible solutions to our issue. It covered some ideas that we actually discussed about this issue, but went more in-depth about the actual implementation. This tool could also potentially be used to write the actual implementation of this system.
- To ensure that the AI output was understandable and correct, I needed to provide context about our product, the issue we were having, as well as questioning the responses it gave to produce a more complete answer.



---

## Yiheng — ChatGPT

### Issue
We wanted to add at least one unit test that is actually valuable for our codebase and acts as a safety net for future refactors, especially around splitting math and rounding.

### Outcomes
- Used ChatGPT to propose unit test cases and expected outputs for our split-calculation utility:
  - Rounding behavior (totals match exactly; no missing pennies).
  - Edge cases: empty items, single user claims all items, item price = 0, and large receipts.
- Produced a test plan mapping acceptance criteria → test cases:
  - “Sum of per-person totals equals receipt total”
  - “Rounding is deterministic across runs”
- Helped draft the initial Jest test structure (describe/it blocks) and suggested how to isolate pure logic into a utility function to make testing easier.

### Reflections
- How useful this tool was / could be going forward:
  Useful for generating a thorough set of edge cases quickly and for guiding how to refactor code into testable units.
- Steps needed to ensure output was correct, understandable, and fair use:
  I manually computed expected totals for a small example receipt and adjusted the generated tests to match our real function signatures and business rules. We only used AI as a starting point; final tests and expected outputs were verified by us.

---

## Edward - Claude Code

### Issue
In the future, we may want to try to add multi-user functionality to the receipt room where different users can claim their own items. The room will be synchronized to a firebase database so that everyone can see live updates to the room. In order to help plan for this, it could be useful to have some high level implementation tasks listed out that need to be done in order to complete this feature. 

### AI Tool Used
Claude Code

### Outcomes Produced
After analyzing the existing codebase, generated implementation tasks for multi-user room functionality with Firebase integration:

1. **Firebase Setup & Backend API** - Install Firebase SDK and configure environment variables; implement backend endpoints (POST /room/create, POST /room/join, GET /room/{id}, PUT /room/{id}/items) with room schema and Firestore integration to enable multi-device sync

2. **QR Code Scanner** - Build scanner screen using expo-camera to scan existing QR codes and extract room ID (QR generation already exists at app/qr/index.tsx)

3. **Real-time Sync with RoomProvider** - Create RoomProvider.tsx with Firebase onSnapshot listeners to replace current local-only ReceiptItemsProvider; sync participants, items, and assignments across all devices in real-time

4. **Security & Error Handling** - Write Firestore security rules for room access control and 24-hour expiration; handle edge cases (expired rooms, invalid QR codes, network errors, loading states)

### Reflections
- Usefuleness: This tool was very useful for quickly creating a high-level implementation plan that considers our existing tech stack. It analyzed our current codebase structure and proposed solutions that integrate with our existing project structure. The plan breaks down this large feature into smaller phases, but we will likely eventually need more in depth and specific sub-issues in order to implement this. This tool could be used to plan other major features like improving the receipt scanning or cashapp/venmo integration.
- Ensure correctness, understandability, and fair use: I verified that the proposed Firebase SDK and dependencies are compatible with our setup by installing firebase on a local branch. I also checked that the suggested API endpoints in step 1 are compatible with the FastAPI setup that we have in backend/app/routers/. The plan is understandable because it's broken into clear phases and categorized steps. Fair use is ensured as this planning is based on our own specific codebase, not from any external sources.


