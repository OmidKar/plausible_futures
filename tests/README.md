# Test Suite Documentation

## Overview

This test suite covers the core business logic of the Ideation App using Vitest and happy-dom.

## Running Tests

```bash
# Run tests in watch mode (recommended during development)
npm test

# Run tests once
npm run test:run

# Run tests with UI (interactive test viewer)
npm run test:ui
```

## Test Coverage

### 1. **Helper Functions** (`helpers.test.js`)
Tests for pure utility functions:
- `defaultDraft()` - Creates empty draft object
- `getDraftKey()` - Generates user-specific localStorage keys
- `getSessionMetaKey()` - Generates session metadata keys

**Coverage**: 100% of helper functions

### 2. **Session Logic** (`session-logic.test.js`)
Tests for core business logic:
- **Session Creation**: Unique ID generation, session structure
- **State Transitions**: Valid state flow (setup → published → voting → final)
- **Participant Management**: Adding participants, preventing duplicates, tracking submissions
- **Row/Topic Management**: Creating rows, locking topics
- **Contribution Submission**: Creating history entries, merging contributions
- **Voting Logic**: Preventing self-voting, preventing duplicate votes, calculating leaderboard
- **Report Generation**: Vote aggregation, sorting, clean report structure

**Coverage**: All major business logic flows

### 3. **localStorage Integration** (`localStorage.test.js`)
Tests for data persistence patterns:
- **Sub-Session Pattern**: User-specific draft isolation
- **Session Metadata**: Separate metadata storage, merging submissions
- **State Updates**: Updating session state without data loss
- **Data Migration**: Handling missing fields gracefully

**Coverage**: All localStorage interaction patterns

## What's NOT Tested

To keep tests focused and maintainable, the following are intentionally not tested:
- **React component rendering** - Would require heavy mocking
- **UI interactions** - Better suited for E2E tests
- **API placeholders** - Will be tested once real API is implemented
- **Browser-specific behaviors** - Covered by E2E tests

## Test Philosophy

1. **Focus on Business Logic**: Test the "what" not the "how"
2. **Avoid Brittle Tests**: Don't test implementation details
3. **Test Behavior**: Verify outcomes, not internal state
4. **Keep It Simple**: Pure functions are easiest to test

## Installing Test Dependencies

If dependencies aren't installed yet:

```bash
npm install --save-dev vitest @vitest/ui happy-dom
```

## Test File Structure

```
tests/
├── setup.js              # Test environment setup (mocks, globals)
├── helpers.test.js       # Helper function tests
├── session-logic.test.js # Business logic tests
├── localStorage.test.js  # Storage pattern tests
└── README.md             # This file
```

## Writing New Tests

When adding new features, follow this pattern:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
    localStorage.clear();
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test data';
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines. Add this to your CI config:

```yaml
- name: Run tests
  run: npm run test:run
```

## Future Enhancements

- Add E2E tests for full user flows
- Add API integration tests once backend is implemented
- Add performance tests for large sessions
- Add accessibility tests for UI components

