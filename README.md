# Title: Eezy Receipt

Description: Take a picture of a receipt and then drag each item on the receipt to the respective buyer.

## Members: 
**Yiheng Feng** (1274613951)\
**Leifeng Chen** (Redstoneweewee)\
**Roy Lee** (roy-lee7473)\
**Edward Garcia** (ELEXG)\
**Mason Le** (masonle6080)\
**Ken Thampiratwong** (ken-tummada)\
**Charlie Nava** (gupperfisher)

## Audience / User Roles:
Our ideal users are people with roommates. There are two different types of users, the user who bought the items and took the picture of the receipt (**Shopper**) and the users who got 
certain items but didn't pay yet (**Friend**). For short receipts, the person who took the picture will be able to drag items on the receipt to the names of the person who bought that item. For long receipts, the app will generate a QR code that other people can scan and access the receipt and then drag their own items. The goal for this app is to settle debts, and the app accomplishes this goal by accurately splitting the cost of the receipt.

## App Type:
Our main focus is iOS, and then Web and Android afterwards.

## Framework / Tech Stack: 
- Frontend: Typescript, React Native, Tailwind/Nativewind
- Expo for frontend app development
- Vite for frontend web development
- Backend: Python
- Supabase

## MVP Expanded Description:
Take a picture(s) of a receipt and upload it into the app. Once uploaded, the user will be able to create as many baskets as they need, 
and each basket will represent someone that the user shopped with. Then, the user will be able to drag each item on the receipt to the respective basket 
of the person who bought that item. Once all items have been dragged, the total cost of the items in each basket will be calculated.



# Installation
## v2.0.0 Testflight Build

If you have an iOS device, you can install v2.0.0 directly on your phone through the Testflight app.

1. Download the Testflight app on your phone
2. Open this link on your phone: https://testflight.apple.com/join/8bhMpGgZ
3. Accept the beta testing invitation in the Testflight app

And you're set!

## v2.0.0 Local Development

These steps run the app locally. Features that rely on OCR/AI will require API keys. Please contact the developers for the keys.

### Requirements

- **Node.js 18+** (includes npm)
- **Git** (to clone the repo)
- **Expo Go** on a mobile device (for testing the mobile app)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ucsb-cs148-w26/pj04-receipt-divider.git
   cd pj04-receipt-divider
   ```

2. **Install dependencies (workspaces):**
   ```bash
   npm install
   ```

### Run the mobile app (Expo)

```bash
cd frontend
npm run start -w apps/mobile
```

Then scan the QR code with Expo Go, or use an emulator

### Run the web app (Vite)

```bash
cd frontend
npm run dev -w apps/web
```

Open the local URL printed by Vite in your browser.

## Functionality

### Core Features Walkthrough:

#### 1. **Receipt Capture**
- **Take Photo**: Use the camera to capture a receipt directly within the app
- **Upload Photo**: Select an existing receipt image from your device's gallery
- **OCR Processing**: The app automatically extracts item names and prices using Google Cloud Vision API

#### 2. **Smart Item Parsing**
- **AI Enhancement**: OpenAI processes the extracted text to clean up item names and improve accuracy
- **Item Detection**: Automatically identifies individual items, quantities, and prices
- **Error Handling**: Manual correction options for misread items

#### 3. **Item Assignment**
- **Drag & Drop Interface**: Intuitive gesture-based assignment of items to participants
- **Personal Baskets**: Each participant has their own digital basket to collect their items
- **Visual Feedback**: Clear visual indicators show which items belong to whom

#### 4. **Cost Calculation**
- **Automatic Totaling**: Real-time calculation of each person's total cost
- **Tax & Fee Distribution**: Proportional splitting of taxes and additional fees
- **Final Summary**: Clear breakdown of who owes what amount

#### 5. **User Experience**
- **Navigation**: Tab-based navigation between different app sections
- **Haptic Feedback**: Touch feedback for better user interaction
- **Responsive Design**: Works on both iOS and Android devices

## Known Problems

Currently, this is an MVP (Minimum Viable Product) in active development. Known limitations include:

- **OCR Accuracy**: May struggle with poor quality receipt images or unusual receipt formats
- **Network Dependency**: Requires internet connection for OCR and AI processing features
- **Limited Testing**: Primary testing has been on iOS devices; Android compatibility may vary
- **Beta Features**: Some advanced features are still in development

For specific bug reports or issues, please check the team retrospectives in the `/team/retrospectives/` directory.

## Contributing

### For Team Members:
1. **Branch Strategy**: Create feature branches from `main` for new development
2. **Documentation**: Update relevant documentation in `/team/` directory
3. **Code Standards**: Follow the ESLint configuration and run `npm run format` before committing
4. **Testing**: Test on both iOS and Android devices when possible

### For External Contributors:
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Follow** the existing code style and structure
4. **Test** your changes thoroughly
5. **Submit** a Pull Request with a clear description of changes

### Development Setup:
- Review the team agreements in `/team/!AGREEMENTS.md`
- Check current sprint planning in `/team/sprint*/` directories
- Follow the coding standards established in the project's ESLint configuration

### Communication:
- For major changes, please open an issue first to discuss the proposed changes
- Reference relevant user stories and acceptance criteria when contributing

Fork it!
Create your feature branch: git checkout -b my-new-feature
Commit your changes: git commit -am 'Add some feature'
Push to the branch: git push origin my-new-feature
Submit a pull request :D

# License
[license](./LICENSE.md)


# Application Flow Diagram:
![Wireframe](./resources/UI%20outline.png)
