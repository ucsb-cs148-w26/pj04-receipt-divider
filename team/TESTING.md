# Testing Documentation

## Testing Libraries and Frameworks

### Primary Testing Framework: Jest

Our project uses **Jest** as the primary testing framework across all frontend packages (web, mobile, and shared). Jest provides a comprehensive testing solution with built-in mocking capabilities, test runners, and assertion libraries.

#### Testing Libraries Used:

1. **Jest (^30.2.0)** - Main testing framework
2. **@testing-library/react-native (^13.3.3)** - Testing utilities for React Native components
3. **@testing-library/react (^16.3.2)** - Testing utilities for web React components
4. **@testing-library/jest-dom (^6.9.1)** - Custom Jest matchers for DOM assertions
5. **jest-expo (^54.0.17)** - Expo-specific Jest preset for React Native testing
6. **ts-jest (^29.4.6)** - TypeScript support for Jest

### Project Structure and Configuration

The testing setup is configured with a **monorepo structure** using Jest projects:

- **Root Jest Config** ([frontend/jest.config.ts](frontend/jest.config.ts)) - Configures multiple projects
- **Web Project** ([frontend/apps/web/jest.config.ts](frontend/apps/web/jest.config.ts)) - Uses jsdom environment
- **Mobile Project** ([frontend/apps/mobile/jest.config.ts](frontend/apps/mobile/jest.config.ts)) - Uses jest-expo preset
- **Shared Package** ([frontend/shared/jest.config.ts](frontend/shared/jest.config.ts)) - Uses jest-expo preset for cross-platform components

#### Key Configuration Features:

1. **Environment-specific setups**: jsdom for web, jest-expo for mobile/shared
2. **Module path mapping**: Absolute imports with `@/` and `@shared/` aliases
3. **Transform ignore patterns**: Configured to handle React Native and Expo modules
4. **Coverage collection**: Tracks test coverage across TypeScript files

### Test Scripts Available

From [frontend/package.json](frontend/package.json):

```bash
# Run all tests
npm test

# Watch mode for all tests
npm run test:watch

# Generate coverage reports
npm run test:coverage

# Project-specific test commands
npm run test:mobile
npm run test:web  
npm run test:shared

# Project-specific watch modes
npm run test:mobile:watch
npm run test:web:watch
npm run test:shared:watch
```

## Test Types Implemented

1. **Unit Tests**: Testing individual component behavior
2. **Integration Tests**: Testing component interactions
3. **Render Tests**: Ensuring components render without errors

## Backend Testing Status

Currently, **no backend testing framework is implemented**. The backend uses FastAPI with Python but doesn't have test dependencies configured.

## Unit Testing Plans Going Forward

**Decision**: We will maintain our current Jest-based testing framework for frontend components but will **not be expanding** our testing infrastructure significantly.

**Reasoning**: 
- Our current Jest setup with React Testing Library provides adequate coverage for critical frontend functionality
- Time constraints in our development sprint require prioritizing feature development over comprehensive test expansion
- Our CI/CD pipeline provides automated testing of existing test suites, ensuring quality control without additional overhead
- Adding extensive unit testing for every component would require significant time investment that we've allocated to core feature development

## Component/Integration/End-to-End Testing Requirement Satisfaction

**Testing Library Used**: Jest with @testing-library/react and @testing-library/react-native

**Implementation Coverage**:
1. **Component Tests**: Individual component behavior testing (e.g., [ReceiptItem.test.tsx](../frontend/shared/src/components/__tests__/ReceiptItem.test.tsx))
   - Tests component rendering, user interactions, and state management
   - Validates prop handling and event callbacks
   
2. **Integration Tests**: Screen-level integration testing (e.g., [app-render.test.tsx](../frontend/apps/mobile/__tests__/app-render.test.tsx))
   - Tests multiple components working together within screen contexts
   - Validates routing and navigation integration
   - Tests cross-component data flow
   
3. **Render Tests**: Comprehensive screen rendering validation
   - Ensures all major screens (HomeScreen, CameraScreen, ReceiptRoomScreen, etc.) render without errors
   - Tests component mounting and unmounting behaviors
   - Validates proper handling of external dependencies through mocking

**Code Coverage**: Our tests cover critical user interfaces across web, mobile, and shared component packages.

## Higher-Level Testing Plans Going Forward

**Decision**: We will **not be implementing** additional higher-level testing frameworks (E2E, backend testing, etc.).

**Reasoning**:
1. **Resource Constraints**: Our team has limited time remaining in the sprint cycle, and implementing comprehensive E2E testing (Detox, Cypress, etc.) would require significant setup time
2. **CI/CD Coverage**: Our existing CI/CD pipeline already runs our current test suite automatically, providing continuous quality assurance
3. **Risk vs. Benefit**: The additional overhead of maintaining E2E tests outweighs the benefits for our project scope and timeline
4. **Backend Simplicity**: Our FastAPI backend is relatively straightforward, and manual API testing has been sufficient for our current needs

**Quality Assurance Strategy**: We will rely on our existing automated frontend testing combined with manual testing and our CI/CD pipeline to maintain code quality.
