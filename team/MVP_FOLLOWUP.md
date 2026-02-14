# MVP FOLLOWUP
## Feedback Grouped and Sorted

**Feature Requests**
- Venmo integration for seamless payment
- Allow multiple receipts to be added within one session
- Save the receipt for later use

**Receipt**
- Account for how taxes are calculated

**User functionality**
- Allow users to login
- Allow users to invite other users to the room

**UI Feedback**
- Make a web version
- Make the UI more aesthetic and consistent
- Improve readability
- Make UI more intuitive

## Response Actions
We created a list of things to do and split up work accordingly, subject to change:  
  
**Deployment**  
- Database hosting and setup Firebase for user registration and receipt storing - Ken
- Backend hosting - Ken
- Web frontend hosting (prob. Vercel) - Ken
- Deploy Mobile App - Leifeng

**UI**
- Install Material UI = Mason
- Set up React Native -> React for web build (Vite) - Mason
- Make sure Tailwind and Nativewind have no build errors
- Basic shared components for style consistency (make react native component) - Roy/Edward
    - Buttons
    - Links
    - User icon
    - Etc.

**Features**
- Receipt group joining via link (QR code) - Ken
    - Link generation service on the backend for authenticated users
    - Guest auth via mobile number?
- Auth service for registered users (receipt host) - Yiheng
- Database real-time sync for room functionality - Yiheng
- Tax calculation - Charlie
- Save the receipt image for reference - Charlie
- Add multiple receipts - Edward

## Next Steps
First we need to setup the web build.  
Create issues and add to kanban board.  
Start working on completing your assigned features/issues.  