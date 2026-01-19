# GitHub Actions CI/CD Pipeline

## Overview

This document explains the Continuous Integration (CI) pipeline implemented using GitHub Actions for the EventBoard API. The pipeline ensures code quality, runs tests, and builds the application on every push and pull request.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI Pipeline                    │
│                                                                  │
│  Trigger: Push to main OR Pull Request to main                 │
│                                                                  │
│  ┌────────────┐                                                 │
│  │   LINT     │  ← ESLint + TypeScript Check                   │
│  └─────┬──────┘                                                 │
│        │                                                         │
│        ├──────────┬──────────────┐                              │
│        ▼          ▼              ▼                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │   TEST   │ │   E2E    │ │  (wait)  │                       │
│  │          │ │          │ │          │                       │
│  │ Unit +   │ │ + DB     │ │          │                       │
│  │ Coverage │ │ Service  │ │          │                       │
│  └────┬─────┘ └────┬─────┘ └──────────┘                       │
│       │            │                                            │
│       └────────┬───┘                                            │
│                ▼                                                 │
│          ┌──────────┐                                           │
│          │  BUILD   │  ← Compile TypeScript                    │
│          └────┬─────┘                                           │
│               │                                                  │
│               ▼                                                  │
│        ┌──────────────┐                                         │
│        │ CI-SUCCESS   │  ← Required for merge                  │
│        └──────────────┘                                         │
│                                                                  │
│  All jobs must pass for CI ✅                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow File

**Location:** `.github/workflows/ci.yml`

## Trigger Configuration

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### When Pipeline Runs

| Event | Branch | Action |
|-------|--------|--------|
| Push | `main` | Run full pipeline |
| Pull Request | → `main` | Run full pipeline |
| Push | feature branch | No pipeline (unless configured) |

### Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Purpose:** Cancel in-progress runs when new commit is pushed
- Saves CI minutes
- Faster feedback on latest code
- Groups by workflow + branch

**Example:**
1. Push commit A → CI starts
2. Push commit B → CI for A is cancelled, CI for B starts

## Pipeline Jobs

### Job 1: Lint

**Purpose:** Code quality and style checks

```yaml
lint:
  name: Lint
  runs-on: ubuntu-latest
  
  steps:
    - Checkout code
    - Setup Node.js 20
    - Install dependencies (npm ci)
    - Run ESLint
    - Check TypeScript compilation
```

#### What It Checks

1. **ESLint** (`npm run lint`)
   - Code style violations
   - Best practices
   - Potential bugs
   - Unused variables
   - Import organization

2. **TypeScript** (`npx tsc --noEmit`)
   - Type errors
   - Syntax errors
   - Missing imports
   - Configuration issues

#### Why It Matters

- ✅ Catches errors before they reach production
- ✅ Enforces consistent code style
- ✅ Prevents TypeScript compilation errors
- ✅ Fast feedback (< 1 minute)

#### Output Example

```bash
✓ ESLint passed (0 errors, 0 warnings)
✓ TypeScript compilation successful
```

---

### Job 2: Unit Tests

**Purpose:** Test individual components in isolation

```yaml
test:
  name: Unit Tests
  runs-on: ubuntu-latest
  needs: lint  # Only run if lint passes
  
  steps:
    - Checkout code
    - Setup Node.js 20
    - Install dependencies
    - Run tests with coverage
    - Upload coverage to Codecov
```

#### What It Tests

- **Service Logic:** Business rules, validations
- **State Machines:** Event transitions
- **Error Handling:** Exception scenarios
- **Edge Cases:** Boundary conditions

#### Coverage Thresholds

```json
{
  "coverageThreshold": {
    "global": {
      "statements": 10,
      "branches": 5,
      "functions": 10,
      "lines": 10
    }
  }
}
```

Currently low thresholds, increase as more tests are added.

#### Coverage Reporting

```yaml
- name: Upload coverage reports
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage/lcov.info
    fail_ci_if_error: false
  continue-on-error: true
```

**Codecov Integration:**
- Tracks coverage over time
- Shows coverage diff in PRs
- Visualizes untested code
- `fail_ci_if_error: false` → Don't fail if Codecov upload fails

#### Output Example

```bash
Test Suites: 3 passed, 3 total
Tests:       54 passed, 54 total
Coverage:    
  Statements: 45% (120/265)
  Branches:   30% (45/150)
  Functions:  50% (25/50)
  Lines:      45% (115/255)
```

---

### Job 3: E2E Tests

**Purpose:** Test complete user journeys with real database

```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: lint  # Parallel with unit tests
  
  services:
    postgres:
      image: postgres:15-alpine
      env:
        POSTGRES_USER: testuser
        POSTGRES_PASSWORD: testpass
        POSTGRES_DB: eventboard_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
```

#### PostgreSQL Service Container

**Why Separate Service?**
- GitHub Actions provides service containers
- Automatically started before job
- Automatically cleaned up after job
- Runs on same network as job

**Health Check:**
```yaml
options: >-
  --health-cmd pg_isready
  --health-interval 10s
  --health-timeout 5s
  --health-retries 5
```

- Ensures Postgres is ready before tests run
- Prevents "connection refused" errors
- Retries up to 5 times

#### Environment Variables

```yaml
env:
  DATABASE_HOST: localhost
  DATABASE_PORT: 5432
  DATABASE_USER: testuser
  DATABASE_PASSWORD: testpass
  DATABASE_NAME: eventboard_test
  JWT_SECRET: ci-test-jwt-secret-key-for-testing-only
  NODE_ENV: test
```

**Note:** Different from development `.env` - isolated test environment

#### Test Execution

```bash
# Wait for Postgres
until pg_isready -h localhost -p 5432 -U testuser; do
  echo "Waiting for postgres..."
  sleep 2
done

# Run E2E tests
npm run test:e2e -- --forceExit --detectOpenHandles
```

**Flags:**
- `--forceExit`: Force exit after tests (don't wait for async operations)
- `--detectOpenHandles`: Detect open connections that prevent exit

#### What It Tests

- **Critical Flow:** Signup → Login → Create Event → Submit → Approve
- **Authentication:** JWT token generation and validation
- **Authorization:** Role-based access control
- **State Transitions:** Complete moderation workflow
- **Database Operations:** Create, read, update with real DB

#### Output Example

```bash
 PASS  test/critical-flow.e2e-spec.ts (12.5s)
  Critical Flow E2E Test
    ✓ should complete user signup (250ms)
    ✓ should login user (180ms)
    ✓ should create event as draft (120ms)
    ✓ should submit event for moderation (95ms)
    ✓ should approve event as moderator (110ms)
    ✓ should verify final state (85ms)
```

---

### Job 4: Build

**Purpose:** Verify application compiles successfully

```yaml
build:
  name: Build
  runs-on: ubuntu-latest
  needs: [test, e2e]  # Only after tests pass
  
  steps:
    - Checkout code
    - Setup Node.js 20
    - Install dependencies
    - Build application
    - Verify dist folder
    - Upload build artifacts
```

#### Build Process

```bash
npm run build
# → Compiles TypeScript to JavaScript
# → Outputs to dist/ directory
```

#### Artifact Upload

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: dist
    path: dist/
    retention-days: 7
```

**Purpose:**
- Store compiled code for 7 days
- Can be downloaded for debugging
- Can be used for deployment
- Proves build is successful

#### Output Example

```bash
✓ Build completed successfully
✓ dist/ folder contains:
  - main.js
  - main.js.map
  - modules/...
  - common/...
```

---

### Job 5: CI Success

**Purpose:** Single job for branch protection rules

```yaml
ci-success:
  name: CI Success
  runs-on: ubuntu-latest
  needs: [lint, test, e2e, build]
  if: always()  # Run even if previous jobs fail
  
  steps:
    - name: Check all jobs passed
      run: |
        if [[ "${{ needs.lint.result }}" != "success" ]] || \
           [[ "${{ needs.test.result }}" != "success" ]] || \
           [[ "${{ needs.e2e.result }}" != "success" ]] || \
           [[ "${{ needs.build.result }}" != "success" ]]; then
          echo "One or more jobs failed"
          exit 1
        fi
        echo "All CI checks passed! ✅"
```

#### Why This Job?

**Problem:** GitHub branch protection can only require one job

**Solution:** Create a single job that depends on all others

**Branch Protection Rule:**
```
✅ Require status checks to pass before merging
   ☑ ci-success
```

Now PRs can only merge if all jobs pass.

#### How It Works

1. `needs: [lint, test, e2e, build]` → Wait for all jobs
2. `if: always()` → Run even if jobs fail
3. Check each job's result
4. Exit 0 (success) only if ALL passed
5. Exit 1 (failure) if ANY failed

---

## Dependency Graph

```
Trigger (Push/PR)
       │
       ▼
    ┌──────┐
    │ LINT │
    └───┬──┘
        │
    ┌───┴────┬──────┐
    │        │      │
    ▼        ▼      ▼
  TEST     E2E   (wait)
    │        │      │
    └───┬────┘      │
        ▼           │
     BUILD          │
        │           │
        └─────┬─────┘
              ▼
         CI-SUCCESS
```

**Execution Order:**
1. **Parallel:** Lint runs first
2. **Parallel:** Test and E2E run after Lint (can run simultaneously)
3. **Serial:** Build runs after Test and E2E complete
4. **Serial:** CI-Success runs after all jobs

**Total Time:** ~3-5 minutes (parallelization saves time)

---

## Environment & Configuration

### Runner Environment

```yaml
runs-on: ubuntu-latest
```

- **OS:** Ubuntu Linux (latest LTS)
- **Architecture:** x64
- **Pre-installed:** Node.js, npm, git, Docker, PostgreSQL client
- **Fresh Environment:** Each job gets clean VM

### Node.js Setup

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

**Features:**
- **Version:** Node.js 20 (same as development)
- **Cache:** Caches `~/.npm` directory
- **Speed:** Faster `npm ci` on subsequent runs

### Dependency Installation

```yaml
- name: Install dependencies
  run: npm ci
```

**Why `npm ci` not `npm install`?**
- ✅ Faster (uses `package-lock.json` exactly)
- ✅ Deterministic (same versions every time)
- ✅ Cleaner (removes `node_modules` first)
- ✅ CI-optimized (designed for automation)

---

## Secrets & Environment Variables

### Current Setup

All values are hardcoded in workflow file:
```yaml
env:
  DATABASE_HOST: localhost
  DATABASE_USER: testuser
  JWT_SECRET: ci-test-jwt-secret-key-for-testing-only
```

**OK for CI because:**
- Test environment (not production)
- Isolated database (created and destroyed per run)
- No real data

### Production Secrets (Future)

For production deployment, use GitHub Secrets:

```yaml
env:
  DATABASE_PASSWORD: ${{ secrets.DB_PASSWORD }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  API_KEY: ${{ secrets.API_KEY }}
```

**Add Secrets:**
1. Go to: Repository → Settings → Secrets and Variables → Actions
2. Click: "New repository secret"
3. Add: Name and Value
4. Reference in workflow: `${{ secrets.SECRET_NAME }}`

---

## Caching Strategy

### NPM Cache

```yaml
uses: actions/setup-node@v4
with:
  cache: 'npm'
```

**What's Cached:**
- `~/.npm` directory
- Downloaded packages
- Metadata

**Cache Key:** Based on `package-lock.json` hash

**Benefit:** 30-60s faster `npm ci`

### When Cache is Invalidated

- `package-lock.json` changes
- Manual cache clearing
- Cache older than 7 days

---

## Workflow Outputs & Artifacts

### Test Coverage Report

```yaml
- name: Upload coverage reports
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage/lcov.info
```

**Where to View:**
- Codecov dashboard (if configured)
- CI job logs
- Downloaded artifacts

### Build Artifacts

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: dist
    path: dist/
    retention-days: 7
```

**How to Download:**
1. Go to: Actions tab → Select workflow run
2. Scroll to: "Artifacts" section
3. Click: "dist" to download

**Use Cases:**
- Debug build issues
- Deploy to staging
- Compare builds

---

## Status Badges

Add to README.md:

```markdown
![CI](https://github.com/your-org/repo/actions/workflows/ci.yml/badge.svg)
```

Shows:
- ✅ Green: All checks passing
- ❌ Red: Some checks failing
- 🟡 Yellow: Running

---

## Troubleshooting

### Common Issues

#### 1. Lint Fails Locally But Passes in CI

**Cause:** Different ESLint configurations

**Fix:**
```bash
# Use same command as CI
npm run lint
```

#### 2. Tests Pass Locally But Fail in CI

**Possible Causes:**
- Environment variables different
- Database state different
- Timezone differences
- Race conditions

**Debug:**
```yaml
- name: Debug environment
  run: |
    echo "Node version: $(node -v)"
    echo "NPM version: $(npm -v)"
    env | sort
```

#### 3. E2E Tests Timeout

**Cause:** Postgres not ready

**Fix:** Already handled by health check, but can increase timeout:
```yaml
options: >-
  --health-retries 10
```

#### 4. Build Artifacts Not Uploaded

**Cause:** Build failed before upload

**Fix:** Check build logs, ensure `dist/` exists

#### 5. CI Running on Wrong Branch

**Cause:** Trigger configuration

**Fix:**
```yaml
on:
  push:
    branches: [main, develop]  # Add more branches
```

---

## Performance Optimization

### Current Pipeline Time

| Job | Duration |
|-----|----------|
| Lint | ~45s |
| Test | ~60s |
| E2E | ~90s |
| Build | ~50s |
| **Total** | **~3-4 min** (parallelized) |

### Optimization Tips

#### 1. Dependency Caching (✅ Already Enabled)

```yaml
with:
  cache: 'npm'
```

**Saves:** 30-60s per job

#### 2. Parallel Jobs (✅ Already Enabled)

Test and E2E run in parallel after Lint

**Saves:** 60-90s total

#### 3. Skip Jobs on Docs Changes

```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

**Saves:** Entire pipeline for doc-only changes

#### 4. Matrix Testing (Future)

Test on multiple Node versions:
```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
```

---

## Security Considerations

### Current Security Measures

1. **`npm ci` instead of `npm install`**
   - Prevents supply chain attacks via `package.json` modification

2. **Service Containers Isolated**
   - Each job gets fresh database
   - No data persists between runs

3. **Secrets Not Logged**
   - GitHub automatically masks secrets in logs

### Recommended Enhancements

1. **Dependency Scanning:**
   ```yaml
   - name: Run npm audit
     run: npm audit --audit-level=moderate
   ```

2. **SAST (Static Analysis):**
   ```yaml
   - name: Run CodeQL
     uses: github/codeql-action/analyze@v2
   ```

3. **Container Scanning:**
   ```yaml
   - name: Scan Docker image
     run: docker scan nestjs_api
   ```

---

## Branch Protection Rules

### Recommended Settings

**Repository → Settings → Branches → Add Rule**

```
Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale reviews
  
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date
  Status checks:
    ☑ ci-success
    
☑ Require conversation resolution before merging
☑ Do not allow bypassing the above settings
```

**Effect:**
- PRs cannot merge unless `ci-success` passes
- Must be up-to-date with main
- Must have 1 approval
- All conversations resolved

---

## Monitoring & Notifications

### GitHub Notifications

**Default:** Email on workflow failure

**Customize:**
1. Go to: Settings → Notifications
2. Configure: Actions notifications

### Slack Integration (Optional)

```yaml
- name: Notify Slack
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "CI failed on ${{ github.ref }}"
      }
```

---

## Cost & Usage

### GitHub Actions Minutes

**Free Tier:**
- Public repos: Unlimited
- Private repos: 2,000 minutes/month

**Current Usage:**
- ~4 minutes per run
- ~10 runs per day (estimate)
- ~1,200 minutes/month (within free tier)

### Storage

**Artifacts:**
- Free: 500 MB
- Current: ~50 MB (dist folder)
- Retention: 7 days (auto-cleanup)

---

## Future Enhancements

### 1. Deploy to Staging

```yaml
deploy-staging:
  name: Deploy to Staging
  needs: ci-success
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to Heroku/Railway/Render
      run: |
        # Deploy commands
```

### 2. Performance Testing

```yaml
performance:
  name: Performance Tests
  needs: build
  steps:
    - name: Run k6 tests
      run: k6 run performance/load-test.js
```

### 3. Security Scanning

```yaml
security:
  name: Security Scan
  steps:
    - name: Run Snyk
      run: npx snyk test
```

### 4. Automated Releases

```yaml
release:
  name: Create Release
  if: github.ref == 'refs/heads/main'
  steps:
    - name: Create GitHub Release
      uses: actions/create-release@v1
```

---

## Conclusion

This CI/CD pipeline provides:

- ✅ **Automated Quality Checks**: Lint, test, build on every PR
- ✅ **Fast Feedback**: ~4 minutes for full pipeline
- ✅ **Parallel Execution**: Test and E2E run simultaneously
- ✅ **Real Database Testing**: PostgreSQL service container
- ✅ **Branch Protection**: Cannot merge failing code
- ✅ **Coverage Tracking**: Codecov integration
- ✅ **Build Artifacts**: Deployable assets stored
- ✅ **Cost-Effective**: Within free tier limits

The pipeline ensures code quality and prevents regressions, giving confidence to merge and deploy.
