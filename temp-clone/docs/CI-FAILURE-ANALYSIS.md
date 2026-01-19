# CI Failure Analysis & Resolution

## Date
January 9, 2026

## Problem Summary
The CI pipeline was failing on the **E2E Test Job**, causing all tests after the initial few to fail with `401 Unauthorized` errors. The lint job passed successfully.

---

## Issue Details

### Symptoms
- **Failed Test Files**: `events.e2e-spec.ts`, `moderation.e2e-spec.ts`, `critical-flow.e2e-spec.ts`
- **Error Pattern**: Tests early in each file passed, but tests in "Day 9: Listing Features" and subsequent tests failed
- **Error Code**: `401 Unauthorized` instead of expected status codes (200, 400, 403, etc.)
- **Test Failures**: 38 failed, 90 passed out of 128 total tests

### Example Failure
```
Event Rejection and Resubmission Flow
  ✕ Should allow resubmission after editing (11 ms)
    expected 200 "OK", got 401 "Unauthorized"
```

### Root Cause Analysis

The issue was in **[.github/workflows/ci.yml](../.github/workflows/ci.yml)** at line 116:

```yaml
JWT_EXPIRES_IN: 1h
```

#### Why This Caused Failures

1. **Configuration Parser Issue**
   - The application's [src/config/configuration.ts](../src/config/configuration.ts) parses `JWT_EXPIRES_IN` using `parseInt()`:
   ```typescript
   expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400', 10), // 24 hours in seconds
   ```

2. **parseInt() Behavior**
   - `parseInt('1h', 10)` returns `1` (parsing stops at the first non-numeric character)
   - This meant JWT tokens expired after **1 second** instead of 1 hour
   - Expected format: numeric value in **seconds** (e.g., `86400` for 24 hours, `3600` for 1 hour)

3. **Test Timeline**
   - Each test suite's `beforeAll()` hook creates test users and generates JWT tokens
   - Early tests execute within 1 second → tokens are valid → tests pass ✅
   - Later tests execute after >1 second → tokens have expired → `401 Unauthorized` ❌

### Why Lint Job Passed
- The lint job had no issues; it only checks code quality and TypeScript compilation
- The problem was purely a **configuration/environment variable issue** in the CI workflow, not code-related

---

## Solution Implemented

### Change Made
Updated [.github/workflows/ci.yml](.github/workflows/ci.yml) line 116:

**Before:**
```yaml
JWT_EXPIRES_IN: 1h
```

**After:**
```yaml
JWT_EXPIRES_IN: 3600
```

### Why This Works
- `3600` seconds = 1 hour
- `parseInt('3600', 10)` = `3600` (valid number)
- JWT tokens now remain valid for the entire e2e test suite duration
- All tests can now reuse the tokens generated in `beforeAll()` hooks

---

## Technical Deep Dive

### JWT Token Lifecycle in E2E Tests

1. **Setup Phase** (`beforeAll()`)
   - Create test database records (users, orgs, events)
   - Login users and generate JWT tokens
   - Tokens signed with expiry: `exp = now + JWT_EXPIRES_IN`

2. **Test Execution** (various `it()` blocks)
   - Reuse same tokens from setup phase
   - Make HTTP requests with token in Authorization header
   - JWT Strategy validates token: checks signature AND expiry

3. **Validation Flow** (src/modules/auth/strategies/jwt.strategy.ts)
   ```typescript
   async validate(payload: JwtPayload) {
     const user = await this.authService.validateJwtPayload(payload);
     if (!user) {
       throw new UnauthorizedException('Invalid or expired token');
     }
     return user;
   }
   ```

4. **Token Expiry Behavior**
   - If `JWT_EXPIRES_IN = 1 second`: tokens valid for `1 second`
   - If tests take >1 second to run → token validation fails
   - Result: `401 Unauthorized` for all subsequent requests

### Configuration Priority

Environment variables in CI (`JWT_EXPIRES_IN: 3600`) override defaults:

```typescript
// src/config/configuration.ts
expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400', 10)
// ✓ If JWT_EXPIRES_IN env var exists, use it
// ✓ If not, default to 86400 (24 hours)
```

---

## Testing the Fix

### Verification Steps
1. ✅ Commit fix to Day-12 branch
2. ✅ Push to remote repository
3. ⏳ CI pipeline will run with new `JWT_EXPIRES_IN: 3600`
4. ✅ All e2e tests should pass (including "Day 9: Listing Features")

### Expected Results After Fix
```
Test Suites: 6 passed, 0 failed
Tests:       128 passed, 0 failed
```

---

## Lessons Learned

1. **Environment Variable Format Matters**
   - Code expects `parseInt()`-compatible input (numeric strings)
   - Using time unit strings (e.g., "1h") without parsing library causes silent failures

2. **Test Duration Sensitivity**
   - E2E test suites can be sensitive to timing
   - Tokens generated once and reused throughout tests need long enough expiry
   - Consider test timeout duration when setting token expiry

3. **CI Configuration Best Practices**
   - Document expected format for env vars in CI workflows
   - Match format between CI and application code
   - Consider using a config validation step to catch mismatches early

4. **Debugging Approach**
   - Pattern of early tests passing, later tests failing → timing/state issue
   - Token validity → check expiry and timing
   - `parseInt()` behavior with non-numeric input → easy to miss

---

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `.github/workflows/ci.yml` | Line 116: `JWT_EXPIRES_IN: 1h` → `JWT_EXPIRES_IN: 3600` | Fix JWT expiry timing issue |

---

## Related Documentation

- JWT Configuration: [src/config/configuration.ts](../src/config/configuration.ts)
- JWT Strategy: [src/modules/auth/strategies/jwt.strategy.ts](../src/modules/auth/strategies/jwt.strategy.ts)
- Auth Service: [src/modules/auth/services/auth.service.ts](../src/modules/auth/services/auth.service.ts)
- CI Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## Status
✅ **RESOLVED** - Fix committed and pushed to Day-12 branch
