# Monorepo: React Native to React Web Build Setup (Vite)

## Description
Configure the monorepo to support building the React Native codebase for web using Vite. This will enable code sharing between mobile and web platforms while maintaining a single codebase.

## Acceptance Criteria
- [ ] Install and configure Vite for web builds:
  - Add Vite and required plugins
  - Configure `vite.config.ts` for React Native Web
  - Set up react-native-web compatibility
- [ ] Update workspace structure:
  - Separate mobile app (`apps/mobile`)
  - Separate web app (`apps/web`)
  - Shared components and logic (`shared/`)
- [ ] Configure platform-specific code handling:
  - `.web.tsx` and `.native.tsx` file extensions
  - Platform-specific imports
  - Environment-based builds
- [ ] Set up build scripts in `package.json`:
  - `npm run build:web` - Build web version
  - `npm run dev:web` - Development server for web
  - `npm run build:mobile` - Build mobile version
- [ ] Configure module resolution for shared code
- [ ] Test that mobile app still works with new structure
- [ ] Test that web app builds and runs correctly
- [ ] Handle platform-specific dependencies:
  - React Native specific packages
  - Web-only packages
- [ ] Document monorepo structure and build process
- [ ] Update CI/CD to handle both web and mobile builds

## Priority
**High** - Foundation for web platform support

## Labels
`monorepo`, `frontend`, `web`, `mobile`, `architecture`, `vite`
