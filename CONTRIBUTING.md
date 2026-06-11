# Contributing Guide

Thank you for your interest in contributing to Deslopify! This guide outlines the process and best practices for contributing to this project.

## Prerequisites

Before making any contributions, please ensure you have:

- Node.js 18+ installed
- Git configured with your name and email
- Basic understanding of Chrome extension development
- Familiarity with YouTube's API usage (though not required for all contributions)

## Project Setup

### Clone the Repository

```bash
git clone https://github.com/your-username/deslopify.git
cd deslopify
```

### Install Dependencies

```bash
npm install
```

### Development Mode

To test the extension locally:

1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select the `deslopify` directory

## Making Changes

### Branch Naming Conventions

Follow these conventions for your branch names:

- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Documentation: `docs/<short-description>`
- Refactoring: `refactor/<short-description>`

Examples:
- `feature/youtube-api-migration`
- `fix/thumbnail-not-restoring`
- `docs/contribution-guide`

### Commit Messages

Use conventional commit format:

```
<type>(<scope>): <description>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code formatting (no functional changes)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Scopes:** (optional, recommended)
- `api`: API client code
- `cache`: Cache implementation
- `content`: Content scripts
- `tests`: Test files
- `docs`: Documentation
- `ui`: User interface

Examples:
```
feat(api): add retry logic for failed API requests
fix(content): prevent title restoration on watch pages
refactor(lib): simplify cache eviction algorithm
docs: add contribution guidelines
```

## Workflow

1. **Fork the Repository**: Fork this repository to your GitHub account
2. **Create a Branch**: Create a feature branch from `main`
3. **Make Changes**: Implement your changes
4. **Run Tests**: Ensure all tests pass
   ```bash
   npm test
   npm run lint
   ```
5. **Add Tests**: If adding new features, add unit tests
6. **Commit Changes**: Make meaningful, atomic commits
7. **Push**: Push to your fork
8. **Create Pull Request**: Submit a pull request against the `main` branch

## Code Quality Standards

### Linting

The project uses ESLint with specific rules:

```bash
npm run lint
```

Ensure your code passes linting before committing:

- No unused variables (except prefixed with `_`)
- Proper TypeScript/JavaScript syntax
- Chrome extension best practices

### Testing

Maintain or improve test coverage:

- Write unit tests for new functions
- Test edge cases and error conditions
- Ensure all existing tests pass
- No breaking changes

### Documentation

- Update README for new features
- Add JSDoc comments for public functions
- Document API usage and parameters

## Pull Request Process

### Checklist Before Submitting

- [ ] All tests pass
- [ ] Code passes linting
- [ ] New features have tests
- [ ] Documentation updated
- [ ] Commit messages follow conventional commits
- [ ] Branch name follows conventions
- [ ] Related issues referenced in commit messages

### Pull Request Template

Please fill out the pull request template:

```
## Summary
[Brief description of changes]

## Changes Made
- [ ] Added new feature
- [ ] Fixed bug
- [ ] Improved documentation
- [ ] Refactored code
- [ ] Added tests

## Testing
- [ ] All unit tests pass
- [ ] All e2e tests pass
- [ ] Manual testing completed

## Issues Addressed
- #<issue-number>: [description]

## Breaking Changes
None

## Checklist
- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Linting passed
```

### Review Process

1. **Automated Checks**: GitHub Actions run linting, testing, and quality checks
2. **Code Review**: Team members review the pull request
3. **Feedback**: Address any comments or suggestions
4. **Merge**: Pull request is merged into `main`

## Working with Existing Code

### Understanding the Architecture

Deslopify uses a modular architecture:

1. **Content Scripts** (`src/content/`): Features injected into YouTube pages
2. **Library Modules** (`src/lib/`): Shared utilities and API clients
3. **UI Components** (`src/options/`, `src/popup/`): Extension user interfaces

### Testing Tips

**Unit Tests** (`tests/unit/`):
- Mock Chrome APIs and external dependencies
- Test pure functions with isolated inputs
- Verify error handling and edge cases

**E2E Tests** (`tests/e2e/`):
- Test real Chrome extension behavior
- Requires Playwright and browser setup
- More expensive but comprehensive

### Performance Considerations

- API responses are cached to reduce YouTube API calls
- Debouncing prevents excessive DOM manipulation
- WeakSet is used for efficient deduplication

## Good First Issues

Look for issues labeled "good first issue" or "help wanted" on GitHub. These are perfect for getting started with the project.

## Need Help?

If you have questions or need guidance:

1. Check existing documentation
2. Ask in the project's GitHub discussions
3. Submit an issue if you encounter problems
4. Join the project's community (if available)

## Project Status

This project is in active development. The `main` branch contains the latest stable version. For the most recent features and fixes, check the `develop` branch.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (same as the rest of the project).

## Code of Conduct

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure respectful collaboration.

---

Thank you for contributing to Deslopify! Your help makes this extension better for everyone.
