# Project Issues - Quick Reference

This document provides quick access to all GitHub issues for the Eezy Receipt project.

## 📍 Location
All detailed issues are in: **[docs/github-issues/](./docs/github-issues/)**

## 📋 Complete Documentation
- **[ISSUES_SUMMARY.md](./docs/github-issues/ISSUES_SUMMARY.md)** - Full overview with sprint planning
- **[README.md](./docs/github-issues/README.md)** - Detailed guide for creating and managing issues
- **[create_issues.sh](./docs/github-issues/create_issues.sh)** - Automation script for bulk issue creation

## 🎯 17 Issues Organized by Category

### 🚀 Deployment (4 issues)
1. [Database Hosting and Setup](./docs/github-issues/01-database-hosting-setup.md) - **High Priority**
2. [Backend Hosting on Vercel](./docs/github-issues/02-backend-hosting-vercel.md) - **High Priority**
3. [Web Frontend Hosting on Vercel](./docs/github-issues/03-web-frontend-hosting-vercel.md) - **High Priority**
4. [Deploy Mobile App](./docs/github-issues/04-mobile-app-deployment.md) - **Medium Priority**

### ⚙️ CI/CD Pipeline (2 issues)
5. [Auto Deployment Pipeline](./docs/github-issues/05-cicd-auto-deployment.md) - **High Priority**
6. [Format Checker, Linter, and Automated Tests](./docs/github-issues/06-cicd-quality-checks.md) - **High Priority**

### 📦 Monorepo Migration (5 issues)
7. [Install Material UI](./docs/github-issues/07-install-material-ui.md) - **Medium Priority**
8. [React Native to React Web Build Setup (Vite)](./docs/github-issues/08-react-native-web-build.md) - **High Priority**
9. [Tailwind and NativeWind Configuration](./docs/github-issues/09-tailwind-nativewind-setup.md) - **High Priority**
10. [Shared Components Library](./docs/github-issues/10-shared-components-library.md) - **High Priority**
11. [Move Image Processing to Backend](./docs/github-issues/11-move-image-processing-backend.md) - **High Priority**

### ✨ Features (6 issues)
12. [Receipt Group Joining via Link/QR Code](./docs/github-issues/12-receipt-group-joining-link-qr.md) - **High Priority**
13. [Authentication Service for Registered Users](./docs/github-issues/13-auth-service-registered-users.md) - **High Priority**
14. [Database Real-time Sync](./docs/github-issues/14-database-realtime-sync.md) - **High Priority**
15. [Tax Calculation](./docs/github-issues/15-tax-calculation.md) - **Medium Priority**
16. [Save Receipt Image for Reference](./docs/github-issues/16-save-receipt-image.md) - **Medium Priority**
17. [Add Multiple Receipts](./docs/github-issues/17-add-multiple-receipts.md) - **Medium Priority**

## 🚀 Quick Start

### Create All Issues Automatically
```bash
cd docs/github-issues
./create_issues.sh
```
*Requires GitHub CLI (`gh`) installed and authenticated*

### Create Issues Manually
1. Navigate to each markdown file in [docs/github-issues/](./docs/github-issues/)
2. Copy the content
3. Create a new GitHub issue
4. Add the suggested labels
5. Assign to team members

## ✅ Key Features of These Issues

- **Clear Acceptance Criteria**: Every issue has specific, measurable checkboxes
- **Comprehensive Coverage**: All tasks from the original roadmap
- **Well Organized**: Categorized by type (Deployment, CI/CD, Monorepo, Features)
- **Prioritized**: High/Medium priority labels for planning
- **Dependencies Noted**: Cross-issue dependencies are documented
- **Sprint Ready**: Includes suggested sprint order in ISSUES_SUMMARY.md

## 📊 Sprint Planning

See [ISSUES_SUMMARY.md](./docs/github-issues/ISSUES_SUMMARY.md) for recommended implementation order across 5 sprints.

## 🏷️ Labels to Create

Make sure these labels exist in your GitHub repository:
- `deployment`, `backend`, `frontend`, `infrastructure`
- `ci-cd`, `github-actions`, `automation`, `testing`
- `monorepo`, `web`, `mobile`, `feature`
- `security`, `performance`, `code-quality`
- And more (see full list in README.md)

---

**Total Issues**: 17  
**High Priority**: 11  
**Medium Priority**: 6  
**Generated**: 2026-02-14
