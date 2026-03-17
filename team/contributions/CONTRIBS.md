# Team Roles and GitHub Contributions

## Contributors Graph Commentary

The GitHub `/graphs/contributors` page lists 9 contributors. Of these, 7 are human team members, 1 is a bot (`copilot-swe-agent[bot]`), and 1 (`masonle-6080`) is an alternate GitHub account used by Mason Le. Some team members also committed under different email addresses or GitHub usernames (e.g., Leifeng Chen committed under both `Leifeng Chen` and `Redstoneweewee`; Mason Le committed under both `masonle6080` and `masonle-6080`; Edward Garcia committed under both his UCSB email and his personal GitHub `ELEXG`; Roy Lee and Yiheng Feng also each have two email addresses appearing in the log). The consolidated commit counts (across all branches, including merges) are:

| Team Member | GitHub Username(s) | Total Commits | Non-Merge Commits |
|---|---|---|---|
| Leifeng Chen | `Redstoneweewee` | ~298 | ~254 |
| Ken Thampiratwong | `ken-tummada` | ~130 | ~120+ |
| Charlie Nava | `Gupperfisher` | ~59 | ~50+ |
| Roy Lee | `roy-lee7473` | ~44 | ~40+ |
| Edward Garcia | `ELEXG` | ~40 | ~35+ |
| Mason Le | `masonle6080`, `masonle-6080` | ~29 | ~15+ |
| Yiheng Feng | `1274613951` | ~17 | ~15+ |

The contributors graph is broadly accurate in showing the relative distribution of commits, although it does not consolidate commits from alternate accounts/emails. The sections below explain each member's actual contributions, which go beyond what raw commit counts convey.

---

## Leifeng Chen

**GitHub:** `Redstoneweewee`
**Roles:** Scrum Master, Design Document Coordinator, Retro 02 Leader

### Code Contributions
Leifeng was the most active contributor by commit count. His work spanned the full frontend stack and project infrastructure:

- **Shared Component Library & Cross-Platform Architecture:** Designed and built the shared component library (`frontend/shared/`) that serves as the reusable foundation for both the mobile and web apps. Migrated existing components to the shared folder and ensured compatibility across React Native (mobile) and React (web).
- **Theming & Styling System:** Implemented the global theming system with light/dark mode support using Tailwind CSS and NativeWind. Created the color theming framework, converted all pages and shared components to Tailwind, and installed tooling like `tailwind-merge` for handling style conflicts.
- **UI Components:** Built core shared UI components including `IconButton`, `SettingsButton`, `CloseButton`, `DefaultButtons`, and various icon button variants. Developed the share functionality (SMS sharing, QR image sharing).
- **Mobile App Features:** Implemented receipt item options and item removal on the items page, QR code page fixes, sign-out button behavior, overlay components, and navigation/routing bug fixes.
- **NativeWind & Tailwind Migration:** Led the full migration from the old styling approach to NativeWind/Tailwind across the mobile app, including installing and configuring NativeWind in the shared package.
- **Testing:** Set up Jest testing infrastructure for the mobile app and wrote initial dependency/startup tests.
- **DevOps & App Deployment:** Managed mobile app deployment via Expo and TestFlight. Created the v2.0.0 TestFlight beta build for iOS.
- **MVP Demo:** Co-edited the MVP demo video with Mason.

### Non-Code Contributions
- Led Sprint 01 planning discussion and documented Sprint 02 planning.
- Served as Scrum Master throughout the project.
- Scribed multiple scrum meetings (Lec04, Lec09, Lec11, Lab08).
- Served as code/PR reviewer in Weeks 5 and 6.
- Led Retro 02.

### Note on Commit Count
Leifeng's high commit count reflects both the volume of his code work and his tendency to make frequent, incremental commits. Many commits are small fixes, refactors, or configuration changes made during active development sessions.

---

## Ken Thampiratwong

**GitHub:** `ken-tummada`
**Roles:** Deployment Document Coordinator

### Code Contributions
Ken was the second most active contributor, focusing heavily on the backend and infrastructure:

- **Backend Architecture:** Designed and implemented the entire backend structure using FastAPI and Python. Created ORM models for all database entities (users, groups, group members, items, item claims, receipts). Built routers, schemas, and service layers.
- **Database Setup:** Set up Supabase as the project database. Created SQL schemas for all tables, policies, and functions. Documented the full database setup in SQL format.
- **Authentication Service:** Implemented the backend auth service, including JWT token generation for testing and user authentication flows.
- **User Services:** Built out user service endpoints and stubs, including test coverage.
- **Room/Group Endpoints:** Created endpoints for creating new groups and joining groups, including join-via-URL functionality.
- **Monorepo Migration:** Helped restructure the project into a monorepo (`frontend/apps/mobile`, `frontend/apps/web`, `frontend/shared`), creating the necessary configuration files and workspace setup.
- **Developer Tooling:** Set up pre-commit hooks (via Husky), backend linting with Ruff, pytest for backend testing, and CLI shortcuts for development workflows.
- **Deployment Documentation:** Created `DEPLOY.md` documenting the deployment process.
- **Receipt Image Storage:** Configured Supabase image bucket for receipt storage.

### Non-Code Contributions
- Scribed the Lec05 scrum meeting.
- Served as code/PR reviewer in Week 7.
- Responsible for all deployment-related documentation (database hosting, backend hosting, web frontend hosting).

---

## Charlie Nava

**GitHub:** `Gupperfisher`
**Roles:** UX Coordinator, Retro 01 Leader

### Code Contributions
Charlie contributed to front-end feature development and UX design:

- **Your Items Page:** Built the "Your Items" page where users can see items assigned to them. Implemented the UI elements for splitting items and the logic to calculate individual totals when items are split among multiple people.
- **Image Cropping:** Implemented the cropping feature when users take a photo of their receipt. 
- **Tax Calculation:** Worked on tax calculation features to proportionally distribute taxes across assigned items.
- **Code Reviews & Fixes:** Reverted problematic import changes to restore app builds. Fixed type compliance issues (e.g., changing ID types from string to number).
- **Issue Cleanup:** Cleaned up old GitHub issue documentation files that were no longer needed.
- **PR Reviews:** Reviewed and merged multiple pull requests as the designated code reviewer in Week 3.

### Non-Code Contributions
- Led Retro 01 as retro leader.
- Served as UX Coordinator, helping guide the design direction of the app.
- Scribed Lec06 and Lab03 scrum meetings.
- Contributed to the AI Coding documentation with reflections on using ChatGPT via Copilot for testing.

---

## Roy Lee

**GitHub:** `roy-lee7473`
**Roles:** Testing/QA Coordinator

### Code Contributions
Roy focused on front-end components, participants functionality, and UI improvements:

- **Participants Feature:** Built the entire participants management system from scratch, including adding, removing, and renaming participants. Implemented color theming for participant components and integrated participants directly into the receipts page (removing the separate participants page).
- **Shared Button Components:** Installed React Native Paper and created shared `Button` components for consistent UI. Later implemented shared icon buttons used across the app.
- **Item Bug Fixes:** Fixed a bug where items could have duplicate IDs in certain scenarios.
- **Remove Item Feature:** Added the remove item button on the "Your Items" page and the options button on the receipt room page with "assign to all" and "remove from all" functionality.
- **Code Quality:** Ran formatting fixes, changed components from default exports to named exports to pass tests, and fixed various test issues.

### Non-Code Contributions
- Served as Testing/QA Coordinator, responsible for coordinating the team's testing strategy.
- Scribed Lec07 and Lab02 scrum meetings.
- Contributed AI Coding documentation analyzing tax calculation approaches using Gemini.

---

## Edward Garcia

**GitHub:** `ELEXG`
**Roles:** Retro 03 Leader

### Code Contributions
Edward worked across both mobile and web frontends, as well as backend integrations:

- **Web App Development:** Set up React Router for the web app, created web routing with placeholder pages, implemented the web join flow with anonymous sign-in, and added web-specific auth context.
- **Multiple Receipts Feature:** Implemented the ability to add multiple receipts within a single session (one of the top-requested features from MVP feedback).
- **Receipt Context:** Created the `ReceiptContext` for managing receipt state across the mobile app, ensuring items are preserved when navigating between pages.
- **Backend OCR Migration:** Migrated the OCR service from the frontend to the backend, refactored endpoints, and fixed the OCR service to properly read quantities and remove unnecessary fields.
- **QR Code Generation:** Implemented QR code generation and room ID creation for receipt sharing.
- **Close Room Flow:** Built the close room confirmation page with proper navigation (navigating to home instead of pushing a new page onto the stack).
- **UI Fixes:** Fixed item ScrollView padding for devices with notches, ran code formatting, and various other UI improvements.

### Non-Code Contributions
- Scribed the Lec02 scrum meeting.
- Will lead Retro 03.
- Contributed AI Coding documentation on planning multi-user room functionality with Firebase using Claude Code.

---

## Mason Le

**GitHub:** `masonle6080`, `masonle-6080`
**Roles:** Product Owner, Final Presentation Leader

### Code Contributions
Mason's contributions focused on project setup, code reviews, and product management:

- **Initial Project Setup:** Created the initial Hello World React Native Expo application during Sprint 01. Set up early project dependencies (`package-lock.json`) and updated the README.
- **Code Reviews & PR Management:** Reviewed and merged a significant number of pull requests throughout the project, especially during Sprint 01. This includes merging PRs for participants, click-on-participants, receipt-context, claim-items, and other key features.
- **MVP Demo Video:** Co-edited the MVP demo video with Leifeng (spending an entire weekend on it).

### Non-Code Contributions
- Served as Product Owner, defining the product vision and user flow.
- Led the initial team discussion to define the MVP.
- Scribed Lec03 and Lab07 scrum meetings.
- Contributed AI Coding documentation on using Claude for testing navigation and mobile operations.
- Will lead the final presentation.

### Note on Commit Count
Mason's commit count is lower than some other members, but this does not fully reflect his contributions. As Product Owner, he spent significant time on product direction, feature prioritization, and coordinating the team's work. His PR review activity (merging many key branches) is also not captured in the commit count. Additionally, he used two GitHub accounts (`masonle6080` and `masonle-6080`), which splits his contributions in the graph.

---

## Yiheng Feng

**GitHub:** `1274613951`
**Roles:** User Manual Coordinator

### Code Contributions
Yiheng focused on critical features like OCR integration and mobile authentication:

- **OCR Service:** Implemented the OCR (Optical Character Recognition) service for extracting text from receipt images. Created the OCR usage guide and integrated the service with the app's camera page.
- **Mobile Supabase Authentication:** Implemented mobile authentication with Supabase, including Google sign-in and email authentication. Stabilized the mobile auth redirect behavior and formatted auth-related files.
- **White Screen Bug Fix:** Fixed a critical white screen bug that occurred when users were signed in, along with improvements to the receipt page and fast reloading behavior.
- **Testing:** Wrote mock `useAuth` tests for mobile dependency testing.

### Non-Code Contributions
- Served as User Manual Coordinator.
- Scribed Lab03 and Lab05 scrum meetings.
- Contributed AI Coding documentation on using ChatGPT for designing split-calculation unit tests and edge cases.

### Note on Commit Count
Yiheng's commit count is on the lower side, but his contributions include some of the most technically important features in the app (OCR and authentication), which are critical to the core user experience. He also committed under two GitHub accounts (`1274613951` and his UCSB email), which splits his visible contributions.

---

## Summary

The team followed a collaborative development model with informal specializations. Leifeng and Ken drove the bulk of the codebase through frontend architecture/shared components and backend infrastructure respectively. Charlie, Roy, and Edward focused on specific frontend features and UI work. Mason played a key product leadership role with significant PR management and demo work. Yiheng contributed high-impact features (OCR and auth) despite fewer total commits. All team members participated in scrum ceremonies, code reviews, retrospectives, and documentation throughout the project.
