# EVAL_RESPONSE.md

## Team Response to Peer Review Feedback  
**Project:** Eezy Receipt  
**Date:** March 6, 2026  

First, our team would like to thank the reviewers for taking the time to explore our application and provide thoughtful feedback. We appreciate the constructive and supportive tone of the comments. The feedback helped us identify both strengths in our current design and areas where we can improve usability, clarity, and functionality before the end of the quarter.

Below we summarize the key sections of the reviewers’ report and outline our team’s response and potential actions.

---

# 1. Feedback Based on Our USER_FEEDBACK_NEEDS.md (Custom Metrics)

The reviewers evaluated our product using the custom metrics we defined in **USER_FEEDBACK_NEEDS.md**, which focused primarily on:

- Ease of understanding the workflow
- Time required to split a receipt
- Clarity of assigning items to participants
- Overall confidence in using the app

### Reviewers’ Feedback
- Confidence levels were generally **moderate**, suggesting the concept was understandable but some interactions were not immediately obvious.
- Estimated time to split a receipt ranged between **2–10 minutes**, indicating the workflow still feels somewhat manual.
- Some users did not immediately realize that items must be **dragged to participants** to assign them.
- Reviewers liked the **concept of visual item assignment**, but suggested improving how the interaction is introduced.


---

# 2. Reviewers’ Understanding of the Product Features

### How the Other Team Understood Our Product
The reviewers correctly identified the main features of our product:

- Uploading or scanning a receipt
- Automatically extracting items using OCR
- Assigning receipt items to participants
- Automatically calculating each person’s cost

This indicates that our **overall product concept was communicated clearly**.

### Positive Feedback
Reviewers liked:

- The **drag-and-drop item assignment**
- The idea of **automatically parsing receipts**
- The **clean interface layout**
- The usefulness of the app for **group dining, shopping, and shared expenses**

### Suggested Improvements
Reviewers suggested improvements including:

- Improving the **accuracy of the receipt parser**
- Making the **item assignment interaction clearer**
- Adding features to **automatically request payments**

---

# 3. Effectiveness of the Product in Its Current State (UI/UX and Robustness)

### Reviewers’ Feedback
The reviewers noted that:

- The interface is **relatively clean and straightforward**
- The **core idea works well conceptually**
- Some interactions were **not immediately obvious**
- Users sometimes felt uncertain about **where to assign items or where totals were displayed**

The reviewers also mentioned that improving the clarity of UI elements would increase confidence in using the app.

---

# 4. Feedback on Deployment Instructions

### Reviewers’ Feedback
The reviewers were generally able to follow the deployment instructions but suggested that additional clarity or documentation could make the process easier.

They indicated that some users may benefit from:

- More detailed setup instructions
- Additional information beyond what was provided in **DEPLOYMENT.md**

### Team Response
We appreciate this feedback and agree that clearer documentation is important for teams trying to evaluate the product. We will expand upon this in our user manual.
---

# 5. Reviewers’ Final Closing Thoughts

### Something They Liked
The reviewers liked the **concept of visually splitting receipts using drag-and-drop**, and they found the idea of automating receipt parsing helpful for real-world group expenses.

### Most Impactful Opportunity for Improvement
The most impactful suggestion was to improve **discoverability and usability of item assignment**, ensuring that users immediately understand how to interact with the interface.

### One More Positive Observation
Reviewers also appreciated the **clean interface design and clear problem the app is trying to solve**.

---

# Final Reflection

Overall, we are grateful for the reviewers’ thoughtful and constructive feedback. The comments confirmed that our **core concept and feature set are understandable and useful**, while also highlighting several areas where usability and documentation can improve.

Our team will focus on:

- Improving **UI feedback and usability** by adding visual hints or onboarding tips explaining the drag-and-drop interaction, highlight effects or animations when an item is draggable, and evaluating ways to reduce the number of steps required to split a receipt.
- Improving **OCR accuracy and robustness** by implementing a muti-stage receipt parsing paradigm for higher accuracy, using both conventional algorithms and lightweight LLMs.
- Expanding **user maunal and deployment documentation** in the near future.

We appreciate the time the reviewers spent evaluating our project and the helpful suggestions they provided. The feedback will guide our next development iterations as we continue refining Eezy Receipt.
