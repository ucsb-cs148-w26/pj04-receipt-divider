# Eezy Receipt - Project Issues and Roadmap

This document provides a comprehensive list of GitHub issues for the Eezy Receipt project, organized by category with clear acceptance criteria.

## Quick Links
- [All Issues Files](./docs/github-issues/)
- [Issue Creation Guide](./README.md)
- [Creation Script](./create_issues.sh)

## Issue Summary

### 🚀 Deployment (4 issues)
| # | Title | Priority | Key Tasks |
|---|-------|----------|-----------|
| 1 | Database Hosting and Setup | High | Firebase/Supabase setup, schema design, security rules |
| 2 | Backend Hosting on Vercel | High | FastAPI deployment, disable OpenAPI in prod, env config |
| 3 | Web Frontend Hosting on Vercel | High | Web build deployment, domain setup, testing |
| 4 | Deploy Mobile App | Medium | App store submission, build configuration, OTA updates |

### ⚙️ CI/CD Pipeline (2 issues)
| # | Title | Priority | Key Tasks |
|---|-------|----------|-----------|
| 5 | Auto Deployment Pipeline | High | GitHub Actions for auto-deploy, Vercel integration |
| 6 | Format Checker, Linter, and Automated Tests | High | Quality checks, branch protection, test automation |

### 📦 Monorepo Migration (5 issues)
| # | Title | Priority | Key Tasks |
|---|-------|----------|-----------|
| 7 | Install Material UI | Medium | MUI setup, theme config, documentation |
| 8 | React Native to React Web Build Setup (Vite) | High | Vite config, workspace structure, platform handling |
| 9 | Tailwind and NativeWind Configuration | High | Resolve build errors, shared config, style guidelines |
| 10 | Shared Components Library | High | Button, Link, UserIcon, tests, documentation |
| 11 | Move Image Processing to Backend | High | Backend OCR endpoint, remove frontend dependencies, security |

### ✨ Features (6 issues)
| # | Title | Priority | Key Tasks |
|---|-------|----------|-----------|
| 12 | Receipt Group Joining via Link/QR Code | High | Link generation, QR codes, guest auth, join flow |
| 13 | Authentication Service for Registered Users | High | Registration, login, JWT, protected routes |
| 14 | Database Real-time Sync | High | Real-time updates, WebSockets/Firebase, conflict resolution |
| 15 | Tax Calculation | Medium | Extract tax, proportional calculation, display |
| 16 | Save Receipt Image for Reference | Medium | Image storage, compression, retrieval, viewer |
| 17 | Add Multiple Receipts | Medium | Session management, combined totals, multi-receipt UI |

## Recommended Implementation Order

### Sprint 1: Foundation & Infrastructure
1. Database Hosting and Setup (#1)
2. Backend Hosting on Vercel (#2)
3. CI/CD Quality Checks (#6)
4. React Native to React Web Build Setup (#8)

### Sprint 2: Styling & Components
5. Tailwind and NativeWind Configuration (#9)
6. Install Material UI (#7)
7. Shared Components Library (#10)
8. CI/CD Auto Deployment (#5)

### Sprint 3: Core Refactoring & Authentication
9. Move Image Processing to Backend (#11)
10. Authentication Service for Registered Users (#13)
11. Web Frontend Hosting on Vercel (#3)

### Sprint 4: Collaboration Features
12. Receipt Group Joining via Link/QR Code (#12)
13. Database Real-time Sync (#14)
14. Deploy Mobile App (#4)

### Sprint 5: Advanced Features
15. Tax Calculation (#15)
16. Save Receipt Image for Reference (#16)
17. Add Multiple Receipts (#17)

## Creating the Issues

### Using GitHub CLI (Recommended)
```bash
cd /tmp/github_issues
./create_issues.sh
```

### Manual Creation
1. Navigate to each markdown file in `/tmp/github_issues/`
2. Copy the title and content
3. Create a new issue in GitHub
4. Add appropriate labels
5. Assign to team members

## Labels Reference

Create these labels in your repository for proper categorization:

**Categories:**
- `deployment`, `backend`, `frontend`, `infrastructure`
- `ci-cd`, `github-actions`, `automation`
- `monorepo`, `web`, `mobile`
- `feature`, `enhancement`

**Technical:**
- `testing`, `code-quality`, `security`, `performance`
- `ui-library`, `components`, `shared-code`
- `styling`, `tailwind`, `nativewind`
- `authentication`, `database`, `realtime`

**Functional:**
- `qr-code`, `sharing`, `collaboration`
- `calculation`, `tax`, `storage`, `images`
- `receipts`, `architecture`, `refactoring`

## Issue Template

Each issue follows this structure:
- **Title**: Clear, descriptive title
- **Description**: Overview of what needs to be done
- **Acceptance Criteria**: Detailed checklist of requirements
- **Priority**: High/Medium/Low
- **Labels**: Relevant categorization tags
- **Dependencies**: Links to prerequisite issues (where applicable)

## Tracking Progress

- Use GitHub Projects to track issue status
- Check off acceptance criteria as work progresses
- Link pull requests to issues
- Close issues when all criteria are met
- Update documentation as features are completed

## Notes

- All issues have been created with clear, measurable acceptance criteria
- Issues are designed to be independent where possible
- Dependencies are explicitly noted in issue descriptions
- Priorities can be adjusted based on team capacity and goals
- Some issues may need to be broken down further during sprint planning

---

**Generated on:** 2026-02-14
**For repository:** ucsb-cs148-w26/pj04-receipt-divider
**Total issues:** 17
