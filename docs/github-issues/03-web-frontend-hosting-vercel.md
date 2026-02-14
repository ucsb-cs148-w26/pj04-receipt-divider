# Web Frontend Hosting on Vercel

## Description
Deploy the web version of Eezy Receipt frontend to Vercel. This requires setting up the React web build from the React Native codebase (see related monorepo migration issue).

## Acceptance Criteria
- [ ] Complete React Native to web build setup (prerequisite)
- [ ] Create Vercel project for web frontend
- [ ] Configure build settings:
  - Build command for web frontend
  - Output directory configuration
  - Node.js version
- [ ] Set up environment variables:
  - Backend API URL (production)
  - Any frontend-specific configuration
- [ ] Configure domain/subdomain for web app
- [ ] Test web app functionality in production:
  - Receipt upload and OCR processing
  - Item assignment UI
  - Cost calculation
  - QR code generation
- [ ] Set up preview deployments for pull requests
- [ ] Configure appropriate caching and CDN settings
- [ ] Verify responsive design works across devices
- [ ] Document deployment process in frontend README

## Priority
**High** - Required for web platform support

## Labels
`deployment`, `frontend`, `web`, `vercel`

## Dependencies
- Requires completion of React Native to React web build setup
