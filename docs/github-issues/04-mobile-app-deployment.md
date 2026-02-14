# Deploy Mobile App

## Description
Prepare and deploy the Eezy Receipt mobile application to app stores (iOS App Store and/or Google Play Store). Configure app for production use with proper build settings and credentials.

## Acceptance Criteria
- [ ] Configure app identifiers and bundle IDs:
  - iOS bundle identifier
  - Android package name
- [ ] Set up production build configurations:
  - Update `app.json`/`app.config.js` with production settings
  - Configure production API endpoints
  - Set appropriate app version and build numbers
- [ ] Prepare iOS deployment:
  - Create Apple Developer account certificates
  - Configure provisioning profiles
  - Generate production build with EAS Build or Xcode
  - Test on TestFlight
- [ ] Prepare Android deployment:
  - Generate signed APK/AAB
  - Configure signing keys and keystore
  - Test on internal testing track
- [ ] Create app store listings:
  - App description and screenshots
  - Privacy policy
  - App store metadata
- [ ] Set up over-the-air (OTA) update capability with Expo Updates
- [ ] Test production builds on physical devices
- [ ] Document deployment process for future releases
- [ ] Submit to app stores for review

## Priority
**Medium** - Important for mobile user base

## Labels
`deployment`, `mobile`, `ios`, `android`, `app-store`
