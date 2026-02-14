# CI/CD: Auto Deployment Pipeline

## Description
Set up automated deployment pipeline using GitHub Actions to automatically deploy web frontend and backend to Vercel when changes are merged to main branch or specific deployment branches.

## Acceptance Criteria
- [ ] Create GitHub Actions workflow file (`.github/workflows/deploy.yml`)
- [ ] Configure auto-deployment for backend:
  - Trigger on push to `main` branch (backend directory changes)
  - Install dependencies (`uv sync`)
  - Run tests (if available)
  - Deploy to Vercel using Vercel CLI or GitHub integration
  - Notify on deployment success/failure
- [ ] Configure auto-deployment for web frontend:
  - Trigger on push to `main` branch (frontend directory changes)
  - Install dependencies (`npm install`)
  - Run build process
  - Deploy to Vercel
  - Notify on deployment success/failure
- [ ] Set up deployment preview for pull requests
- [ ] Configure GitHub secrets for deployment:
  - Vercel tokens
  - Project IDs
- [ ] Add deployment status badges to README
- [ ] Test deployment workflow with dummy changes
- [ ] Document CI/CD pipeline in repository

## Priority
**High** - Improves development workflow and reduces manual deployment errors

## Labels
`ci-cd`, `github-actions`, `automation`, `deployment`
