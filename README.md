# Title: Eezy Receipt

Eezy Receipt is a cross-platform mobile application that simplifies expense splitting among roommates and friend groups by leveraging OCR and AI to automatically extract items from receipt photos and enable intuitive drag-and-drop assignment to individual users. The app automatically calculates each person's exact cost share, including proportional tax and fees, solving the friction point of manual receipt splitting that currently requires tedious spreadsheets or third-party apps. With a focus on iOS and expanding to Android and web, Eezy Receipt targets the massive roommate and group-travel markets by providing a frictionless, real-time solution to settle shared expenses.

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
- React Native because it's for both IOS, Android, and the web. 
- Expo
- Firebase database to store data - no sql, FREE.

## MVP Expanded Description:
Take a picture(s) of a receipt and upload it into the app. Once uploaded, the user will be able to create as many baskets as they need, 
and each basket will represent someone that the user shopped with. Then, the user will be able to drag each item on the receipt to the respective basket 
of the person who bought that item. Once all items have been dragged, the total cost of the items in each basket will be calculated.



# Installation
## Prerequisites

### Required Software:

1. **Node.js** (version 18 or newer recommended)
   - Download from [nodejs.org](https://nodejs.org)
   - This includes npm (Node Package Manager)

2. **Expo CLI** (global installation)
   - Install with: `npm install -g @expo/cli`
   - Alternative: Use npx to run without global installation

3. **Git** (for cloning the repository)
   - Download from [git-scm.com](https://git-scm.com)

### Mobile Device Requirements:

4. **Expo Go App** on your mobile device
   - **iOS**: Download from the App Store
   - **Android**: Download from Google Play Store

### Optional (but recommended):

5. **Yarn** (alternative package manager)
   - Install with: `npm install -g yarn`
   - Can be used instead of npm for faster dependency installation

## Dependencies

### Core Framework:
- **Expo SDK (~54.0.32)** - Cross-platform development framework for React Native
- **React Native (0.81.5)** - Core mobile application framework
- **React (19.1.0)** - JavaScript library for building user interfaces

### Navigation & UI:
- **Expo Router (~6.0.22)** - File-based routing system for navigation
- **@react-navigation/native & /bottom-tabs** - Navigation components and tab navigation
- **NativeWind (^4.2.1)** - Tailwind CSS for React Native styling
- **React Native Gesture Handler** - Native gesture handling
- **React Native Reanimated** - Smooth animations and transitions

### Image & OCR Processing:
- **Expo Image Picker (^17.0.10)** - Camera and gallery access for receipt capture
- **@google-cloud/vision (^5.3.4)** - OCR (Optical Character Recognition) for extracting text from receipts
- **OpenAI (^6.17.0)** - AI processing for intelligent item parsing and categorization

### QR Code & File Management:
- **React Native QRCode SVG (^6.3.21)** - QR code generation for sharing receipts
- **React Native SVG (15.12.1)** - SVG rendering support
- **Expo File System (^19.0.21)** - File management capabilities

### Utilities:
- **Zod (^4.3.6)** - TypeScript-first schema validation
- **Expo Haptics** - Tactile feedback for user interactions
- **Expo Crypto** - Cryptographic functions for secure operations

## Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ucsb-cs148-w26/pj04-receipt-divider.git
   cd pj04-receipt-divider
   ```

2. **Navigate to the app directory:**
   ```bash
   cd ./HelloWorld
   ```

3. **Install dependencies:**
   ```bash
   npm install
   # OR if using Yarn
   yarn install
   ```

4. **Start the development server:**
   ```bash
   npm start
   # OR
   npx expo start
   ```

5. **Run on your device:**
   - Install **Expo Go** on your mobile device
   - Scan the QR code displayed in your terminal/browser with the Expo Go app
   - The app will load on your device

6. **Alternative: Run on simulator/emulator:**
   ```bash
   npm run ios      # For iOS simulator (macOS only)
   npm run android  # For Android emulator
   npm run web      # For web browser
   ```

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
