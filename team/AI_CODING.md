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