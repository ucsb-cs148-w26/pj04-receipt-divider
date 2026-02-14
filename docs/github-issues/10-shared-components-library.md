# Monorepo: Shared Components Library

## Description
Create a library of shared React Native components that work on both mobile and web platforms. These components will ensure style consistency and reduce code duplication across the application.

## Acceptance Criteria
- [ ] Set up shared components directory structure:
  - `shared/components/` directory
  - Proper exports in `index.ts`
  - TypeScript types for all components
- [ ] Create Button component:
  - Multiple variants (primary, secondary, outlined, text)
  - Different sizes (small, medium, large)
  - Loading and disabled states
  - Works on both mobile and web
  - Accessible (proper a11y attributes)
- [ ] Create Link component:
  - Internal navigation (React Navigation for mobile, React Router for web)
  - External links
  - Styled consistently
  - Platform-specific behavior
- [ ] Create UserIcon/Avatar component:
  - Display user initials or image
  - Different sizes
  - Placeholder states
  - Consistent styling
- [ ] Create additional common components:
  - Text/Typography components
  - Input/TextField components
  - Card component
  - Container/View wrappers
- [ ] Add Storybook or similar for component documentation (optional)
- [ ] Write tests for shared components:
  - Unit tests with Jest
  - Snapshot tests
  - Both mobile and web render tests
- [ ] Document component API and usage:
  - Props interface
  - Usage examples
  - Style customization options
- [ ] Update existing code to use shared components

## Priority
**High** - Essential for maintainable, consistent UI

## Labels
`monorepo`, `frontend`, `components`, `ui-library`, `shared-code`
