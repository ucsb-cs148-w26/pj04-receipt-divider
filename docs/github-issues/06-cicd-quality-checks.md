# CI/CD: Format Checker, Linter, and Automated Tests

## Description
Set up GitHub Actions workflow to automatically run code quality checks (formatting, linting, and tests) on pull requests before they can be merged into main branch. This ensures code quality and prevents bugs from reaching production.

## Acceptance Criteria
- [ ] Create GitHub Actions workflow file (`.github/workflows/quality-checks.yml`)
- [ ] Configure format checking:
  - Frontend: Run Prettier check (`npm run format`)
  - Backend: Run Black check (`uv run black --check .`)
  - Fail CI if formatting issues found
- [ ] Configure linting:
  - Frontend: Run ESLint (`npm run lint` or similar)
  - Backend: Add and run linting tool (e.g., ruff, pylint)
- [ ] Configure automated tests:
  - Frontend: Run Jest tests (`npm test`)
  - Backend: Add and run pytest (if tests exist)
  - Generate test coverage reports
- [ ] Set up branch protection rules:
  - Require all checks to pass before merging
  - Require pull request reviews
  - Prevent direct pushes to main
- [ ] Add status checks to pull request UI
- [ ] Configure workflow to run on:
  - Pull requests targeting main
  - Push to main (as safety check)
- [ ] Optimize workflow for performance (caching dependencies)
- [ ] Add CI status badges to README
- [ ] Document quality check requirements for contributors

## Priority
**High** - Essential for maintaining code quality

## Labels
`ci-cd`, `github-actions`, `testing`, `code-quality`, `automation`
