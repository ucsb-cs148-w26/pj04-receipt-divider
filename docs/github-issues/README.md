# GitHub Issues Creation Guide

This directory contains comprehensive GitHub issues with clear acceptance criteria for the Eezy Receipt project. These issues are based on the project roadmap and cover deployment, CI/CD, monorepo migration, and feature implementation.

## Issues Overview

### Deployment (Issues 1-4)
1. **Database Hosting and Setup** - Set up Firebase or Supabase for production
2. **Backend Hosting on Vercel** - Deploy FastAPI backend with OpenAPI disabled in prod
3. **Web Frontend Hosting on Vercel** - Deploy web version of the app
4. **Deploy Mobile App** - Publish to iOS App Store and/or Google Play Store

### CI/CD Pipeline (Issues 5-6)
5. **Auto Deployment Pipeline** - Automated deployment for web and backend
6. **Format Checker, Linter, and Automated Tests** - Quality checks before merging to main

### Monorepo Migration (Issues 7-11)
7. **Install Material UI** - Add MUI component library for web
8. **React Native to React Web Build Setup (Vite)** - Configure web builds from RN codebase
9. **Tailwind and NativeWind Configuration** - Ensure styling works without errors
10. **Shared Components Library** - Create reusable components (Buttons, Links, User Icon, etc.)
11. **Move Image Processing to Backend** - Refactor OCR and AI to run server-side

### Features (Issues 12-17)
12. **Receipt Group Joining via Link/QR Code** - Share receipts with link generation and guest auth
13. **Authentication Service for Registered Users** - User registration, login, and auth
14. **Database Real-time Sync** - Real-time collaboration on receipts
15. **Tax Calculation** - Automatic tax distribution across items
16. **Save Receipt Image for Reference** - Store and retrieve original receipt images
17. **Add Multiple Receipts** - Support multiple receipts in one session

## How to Create Issues

### Option 1: Manual Creation via GitHub UI
1. Go to the repository's Issues tab
2. Click "New Issue"
3. Copy the content from each markdown file
4. Use the title as the issue title
5. Add the suggested labels
6. Assign to team members as appropriate
7. Add to project board if applicable

### Option 2: Using GitHub CLI (gh)
```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Create issues from these files
for file in /tmp/github_issues/*.md; do
  gh issue create --repo ucsb-cs148-w26/pj04-receipt-divider \
    --title "$(head -1 "$file" | sed 's/# //')" \
    --body "$(tail -n +3 "$file")"
done
```

### Option 3: Using GitHub API
See the `create_issues_api.sh` script for automated creation using curl.

## Issue Dependencies

Some issues have dependencies on others. Recommended order:

### Phase 1: Foundation
1. Database Hosting and Setup (Issue 1)
2. Backend Hosting on Vercel (Issue 2)
3. React Native to React Web Build Setup (Issue 8)
4. Tailwind and NativeWind Configuration (Issue 9)

### Phase 2: Infrastructure
5. CI/CD Auto Deployment (Issue 5)
6. Format Checker and Quality Checks (Issue 6)
7. Install Material UI (Issue 7)
8. Shared Components Library (Issue 10)

### Phase 3: Refactoring
9. Move Image Processing to Backend (Issue 11)

### Phase 4: Deployment
10. Web Frontend Hosting on Vercel (Issue 3)
11. Deploy Mobile App (Issue 4)

### Phase 5: Features
12. Authentication Service (Issue 13)
13. Receipt Group Joining (Issue 12)
14. Database Real-time Sync (Issue 14)
15. Tax Calculation (Issue 15)
16. Save Receipt Image (Issue 16)
17. Add Multiple Receipts (Issue 17)

## Labels to Create

Make sure these labels exist in your repository:
- `deployment`
- `backend`
- `frontend`
- `infrastructure`
- `ci-cd`
- `github-actions`
- `automation`
- `testing`
- `code-quality`
- `monorepo`
- `web`
- `mobile`
- `ui-library`
- `dependencies`
- `architecture`
- `styling`
- `tailwind`
- `nativewind`
- `components`
- `shared-code`
- `refactoring`
- `security`
- `performance`
- `feature`
- `qr-code`
- `sharing`
- `authentication`
- `realtime`
- `collaboration`
- `calculation`
- `tax`
- `storage`
- `images`
- `enhancement`
- `receipts`

## Prioritization

### High Priority (Must Have)
- Issues 1, 2, 5, 6, 8, 9, 10, 11, 12, 13, 14

### Medium Priority (Should Have)
- Issues 4, 7, 15, 16, 17

### Low Priority (Nice to Have)
- Additional enhancements based on user feedback

## Notes

- Each issue has clear acceptance criteria with checkboxes
- Issues are self-contained but reference dependencies where needed
- Labels help with filtering and project management
- Priorities are suggestions and can be adjusted based on team capacity and goals

## Maintenance

As issues are completed:
1. Check off acceptance criteria items
2. Update issue status
3. Close issue when all criteria are met
4. Link related PRs to issues
5. Document any deviations or additional work needed
