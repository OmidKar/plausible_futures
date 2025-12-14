# Running Tests

## Important: Server Must Be Running

The tests make HTTP requests to `http://localhost:3001`, so you need to start the server first:

### Terminal 1 - Start Server:
```bash
cd backend
npm run dev
```

### Terminal 2 - Run Tests:
```bash
cd backend
npm test
```

## Why This Approach?

- Tests validate the **full HTTP API** (not just internal functions)
- Ensures routes, middleware, and error handling all work correctly
- Tests the actual API that the frontend will use

## Test Data

Tests create and clean up their own data in the database. If tests fail, you may need to manually clean the database:

```bash
# Delete the database file and restart the server
rm ideation.db
npm run dev
```

## Future Improvement

For production, we should:
1. Use a separate test database
2. Or mock the HTTP layer
3. Or use supertest for in-process testing

For now, this simple approach works for development!

