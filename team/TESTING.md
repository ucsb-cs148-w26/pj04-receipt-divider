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

## Testing Approaches and Patterns

### 1. Component Testing Approach

We primarily use **component-focused unit testing** that tests individual React components in isolation with mocked dependencies.

### 2. Mocking Strategy

Our tests employ comprehensive mocking of external dependencies:

#### Navigation and Routing Mocks
```typescript
jest.mock('expo-router', () => ({
  router: {
    navigate: jest.fn(),
    back: jest.fn(),
    push: jest.fn(),
    dismiss: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({
    roomId: 'test-room-id',
    items: JSON.stringify([]),
    participantId: '1',
  })),
}));
```

#### Theme and UI Mocks
```typescript
jest.mock('@react-navigation/native', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      card: '#FFFFFF',
      text: '#000000',
      border: '#C8C8CC',
      notification: '#FF3B30',
    },
  })),
}));
```

#### Native Module Mocks
```typescript
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Gesture: { Pan: () => ({ /* mock implementation */ }) },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
  };
});
```

### 3. Test Types Implemented

1. **Unit Tests**: Testing individual component behavior
2. **Integration Tests**: Testing component interactions
3. **Render Tests**: Ensuring components render without errors
4. **Dependency Tests**: Validating external dependency handling

## Unit Tests Implemented

### 1. ReceiptItem Component Tests

**Location**: [frontend/shared/src/components/__tests__/ReceiptItem.test.tsx](frontend/shared/src/components/__tests__/ReceiptItem.test.tsx)

This is our most comprehensive test suite covering:

#### Test Coverage:
- **Rendering Tests**: Verifies component renders with correct item name and price
- **User Interaction Tests**: Tests text input changes for name and price fields
- **Data Validation**: Tests price input filtering (removes non-numeric characters)
- **Event Handling**: Tests delete button functionality
- **State Management**: Tests user tag rendering and display
- **Edge Cases**: Handles empty item data gracefully

#### Key Test Examples:
```typescript
it('calls onUpdate when name is changed', () => {
  const { getByDisplayValue } = render(
    <ReceiptItem
      item={mockItem}
      onUpdate={mockOnUpdate}
      onDelete={mockOnDelete}
      onRemoveFromUser={mockOnRemoveFromUser}
    />
  );

  const nameInput = getByDisplayValue('Pizza');
  fireEvent.changeText(nameInput, 'Burger');

  expect(mockOnUpdate).toHaveBeenCalledWith({ name: 'Burger' });
});

it('filters out non-numeric characters from price input', () => {
  const priceInput = getByDisplayValue('12.99');
  fireEvent.changeText(priceInput, 'abc15.50xyz');

  expect(mockOnUpdate).toHaveBeenCalledWith({ price: '15.50' });
});
```

### 2. Application Screen Render Tests

**Location**: [frontend/apps/mobile/__tests__/app-render.test.tsx](frontend/apps/mobile/__tests__/app-render.test.tsx)

#### Test Coverage:
- **Screen Dependency Tests**: Ensures all screens render without dependency errors
- **Critical Integration Tests**: Validates screen startup behavior
- **Error Handling**: Tests graceful handling of missing dependencies
- **Console Error Monitoring**: Ensures no console errors during rendering

#### Screens Tested:
- HomeScreen
- CameraScreen  
- ReceiptRoomScreen
- QRScreen
- YourItemScreen
- SettingsScreen
- ModalScreen
- PictureErrorScreen

### 3. Basic Example Tests

**Locations**: 
- [frontend/apps/web/__tests__/example.test.tsx](frontend/apps/web/__tests__/example.test.tsx)
- [frontend/apps/mobile/__tests__/example.test.tsx](frontend/apps/mobile/__tests__/example.test.tsx)
- [frontend/shared/__tests__/example.test.ts](frontend/shared/__tests__/example.test.ts)

Simple tests ensuring basic functionality and test setup validation.

## Testing Challenges and Solutions

### 1. React Native Testing Complexity
**Challenge**: Testing React Native components requires extensive mocking of native modules.

**Solution**: Comprehensive mock setup covering gesture handlers, navigation, and Expo modules.

### 2. Cross-Platform Component Testing  
**Challenge**: Shared components need to work across web and mobile platforms.

**Solution**: Jest-expo preset configuration with appropriate transform ignore patterns.

### 3. External Dependency Management
**Challenge**: Heavy reliance on Expo and React Navigation requires careful mocking.

**Solution**: Structured mock files with realistic return values for consistent testing.

## Backend Testing Status

Currently, **no backend testing framework is implemented**. The backend uses FastAPI with Python but doesn't have test dependencies configured in [backend/pyproject.toml](backend/pyproject.toml).

**Recommendation**: Consider adding pytest for backend API testing in future iterations.

## Coverage and Quality Metrics

Tests can be run with coverage reporting using:
```bash
npm run test:coverage
```

Coverage reports are generated in the `frontend/coverage/` directory with:
- HTML reports ([frontend/coverage/lcov-report/index.html](frontend/coverage/lcov-report/index.html))
- LCOV format for CI integration
- JSON format for programmatic analysis

## Future Testing Improvements

1. **End-to-End Testing**: Consider adding Detox or similar E2E testing framework
2. **Backend Testing**: Implement pytest for API endpoint testing  
3. **Visual Regression Testing**: Add screenshot testing for UI components
4. **Performance Testing**: Add performance benchmarks for critical components
5. **Accessibility Testing**: Ensure components meet accessibility standards