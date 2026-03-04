# Sprint 02 Planning

**Project:** Receipt Divider

**Sprint Duration:** Week 6 - Week 7/8

**Sprint Planning Date:** February 2026

## Team & Role Assignments

| Role | Team Members |
| --- | --- |
| Backend | Roy, Harry |
| Web Development | Mason |
| Mobile Development | Charlie, Edward, Leifeng |
| Cross-Platform / Shared Components | Leifeng |

## Sprint Goals

### Primary Goals
1. **Set up Shared Component Library**: Establish the shared folder as a reusable library for both web and mobile apps
2. **Mobile UI & Refactoring**: Complete UI implementation and refactor existing code for clarity
3. **QR Code Functionality**: Get QR code scanning fully working for room joining
4. **Web App Framework**: Build out the basic web app structure and frame
5. **Monorepo Setup**: Ensure proper monorepo structure for code sharing and build consistency

### Stretch Goal
- **Template Creator & Auto-formatter**: Advanced feature for extracting and formatting documents based on templates

## Detailed Sprint Work

### Shared Folder (Cross-Platform Library)
**Owner:** Leifeng Chen
**Philosophy:** Think of the shared folder as a library for reusable components

**Requirements:**
- Use React only (for compatibility with both mobile and web apps)
- Use Tailwind CSS for all styling
- Should be compatible with both React Native and web React

**Tasks:**
- Migrate existing components to shared folder
- Ensure all shared components are properly exported
- Set up CSS/styling system with Tailwind
- Test compatibility across mobile and web

**Output:** A well-organized library of reusable UI components and utilities

### Mobile App
**Owners:** Charlie, Edward, Leifeng

**Deliverables:**
1. **UI Implementation**: Complete mobile app user interface based on design mockups
2. **Code Refactoring**: Clean up existing code for maintainability
3. **QR Code Functionality**: 
   - Implement QR code scanner using expo-camera
   - Allow users to join rooms by scanning QR codes
   - Test end-to-end QR scanning and room joining

**Note:** Backend integration with mobile will be done next sprint (Sprint 03)

### Web App
**Owner:** Mason

**Deliverables:**
1. **Basic Framework/Frame**: Establish the foundational structure for the web application
2. **Layout Components**: Create responsive layouts for different screens
3. **Integration with Shared Components**: Use components from the shared library

### Backend
**Owners:** Roy, Harry

**Deliverables:**
- [To be specified based on backend priorities]
- Coordinate with mobile team for next sprint's integration work

## Shared Component Architecture

### Technology Stack for Shared Library
- **Language:** React with TypeScript
- **Styling:** Tailwind CSS (via NativeWind for React Native compatibility)
- **Structure:** Monorepo workspace configuration

### Component Categories
- **(To populate)** UI Elements (buttons, inputs, cards, etc.)
- **(To populate)** Layout Components (containers, grids, etc.)
- **(To populate)** Utility Functions (helpers, formatters, etc.)
- **(To populate)** Type Definitions (shared TypeScript interfaces)

## Sprint Constraints & Considerations

### Timeline
- Sprint ends in **Week 7 or Week 8** (flexible based on progress)
- Aim to have shared folder set up early so web app can proceed in parallel

### Technical Standards
- Code reviews required (rotating reviewer system)
- Conventional commits for all changes
- Pull requests must include code explanations for complex changes
- Keep Kanban board clean (no research/learning tickets)

### Monorepo Structure
Ensure the following structure is properly configured:
```
frontend/
  ├── apps/
  │   ├── mobile/
  │   ├── web/
  └── shared/
        ├── src/
        ├── package.json
        └── tsconfig.json
```

## Success Criteria

### Shared Folder
- [ ] Folder structure established
- [ ] At least 5-10 reusable components migrated
- [ ] Tailwind styling working for both web and mobile
- [ ] Proper TypeScript exports and types

### Mobile App
- [ ] Core UI screens complete
- [ ] QR code scanner fully functional
- [ ] Code refactored and cleaned
- [ ] Integration tests passing

### Web App
- [ ] Basic framework established
- [ ] Can import and use shared components
- [ ] Responsive design foundation in place

### Backend
- [To define based on backend priorities]

## Stretch Goal Details

### Template Creator & Auto-formatter
**Concept:** Advanced feature for document management
- Create templates for document extraction
- Auto-extract specific information from documents based on template
- Re-format documents according to template specifications

**Priority:** Only if primary goals are completed ahead of schedule

## Next Steps (Post-Sprint 02)

- **Sprint 03**: Backend integration with mobile and web apps
- **Sprint 04+**: Payment integration, real-time room sync, advanced features

---

**Last Updated:** February 2026
