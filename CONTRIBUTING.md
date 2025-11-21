# Contributing to iRacing Race Engineer

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 22.x or higher
- pnpm 9.x or higher
- Docker and Docker Compose (for databases)
- Git

### Initial Setup

1. **Fork and Clone**

```bash
git clone https://github.com/yourusername/iracing-race-engineer.git
cd iracing-race-engineer
```

2. **Install Dependencies**

```bash
pnpm install
```

3. **Environment Setup**

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. **Start Infrastructure**

```bash
docker-compose up -d postgres redis
```

5. **Run Development Servers**

```bash
pnpm dev
```

## Project Structure

- `/apps/api` - Backend Fastify application
- `/apps/web` - Frontend Next.js application
- `/packages/shared` - Shared types and utilities
- `/docker` - Docker configuration files

## Code Style

### TypeScript

- Use strict TypeScript with full type coverage
- No `any` types unless absolutely necessary
- Prefer interfaces over types for object shapes
- Use Zod for runtime validation

### Formatting

We use Prettier for code formatting:

```bash
pnpm format
```

### Linting

```bash
pnpm lint
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(telemetry): add lap time prediction
fix(api): resolve memory leak in telemetry processor
docs(readme): update installation instructions
refactor(strategy): simplify fuel calculation logic
```

## Pull Request Process

1. **Create a Feature Branch**

```bash
git checkout -b feat/your-feature-name
```

2. **Make Your Changes**

- Write clean, well-documented code
- Add tests for new functionality
- Update documentation as needed

3. **Test Your Changes**

```bash
# Run tests
pnpm test

# Type check
pnpm type-check

# Build to ensure no errors
pnpm build
```

4. **Commit Your Changes**

```bash
git add .
git commit -m "feat(scope): your descriptive message"
```

5. **Push and Create PR**

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Link to related issues
- Screenshots/videos for UI changes
- Test results

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @iracing-race-engineer/api test

# Watch mode
pnpm --filter @iracing-race-engineer/api test -- --watch
```

### Integration Tests

```bash
# Run integration tests
pnpm test:integration
```

### Writing Tests

- Test files should be named `*.test.ts` or `*.spec.ts`
- Place tests near the code they test
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFuelNeeded } from './fuel-calculator';

describe('calculateFuelNeeded', () => {
  it('should calculate fuel needed for remaining laps', () => {
    // Arrange
    const lapsRemaining = 10;
    const averageConsumption = 2.5;

    // Act
    const result = calculateFuelNeeded(lapsRemaining, averageConsumption);

    // Assert
    expect(result).toBe(25);
  });
});
```

## Documentation

### Code Documentation

- Use JSDoc comments for functions and classes
- Explain complex algorithms
- Document public APIs

```typescript
/**
 * Calculates optimal pit window based on fuel consumption and tire wear
 *
 * @param telemetry - Current telemetry data
 * @param sessionInfo - Session information
 * @returns Pit window recommendation with optimal lap range
 */
export function calculatePitWindow(
  telemetry: ProcessedTelemetry,
  sessionInfo: SessionInfo
): PitWindowRecommendation {
  // Implementation
}
```

### README Updates

When adding new features, update:
- Feature list in README
- API documentation
- Configuration options
- Examples

## Performance Guidelines

### Backend

- Keep telemetry processing under 50ms
- Use streaming for large datasets
- Implement caching for expensive operations
- Use database indexes appropriately

### Frontend

- Minimize re-renders with React.memo
- Use code splitting for large components
- Optimize bundle size
- Lazy load heavy dependencies

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `/apps/api/src/modules/{module}/routes.ts`
2. Add validation schema
3. Implement business logic in service layer
4. Add tests
5. Update API documentation

### Adding a New Frontend Component

1. Create component in `/apps/web/components/{category}/`
2. Use TypeScript for props
3. Add Tailwind CSS for styling
4. Create Storybook story (if applicable)
5. Add tests

### Adding a Shared Type

1. Add type to `/packages/shared/src/types/`
2. Export from `/packages/shared/src/index.ts`
3. Add Zod schema if needed for validation
4. Document the type with JSDoc

## Issue Reporting

### Bug Reports

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, etc.)
- Screenshots/logs if applicable

### Feature Requests

Include:
- Clear description of the feature
- Use case and benefits
- Proposed implementation (if any)
- Alternatives considered

## Questions?

- Open a GitHub Discussion
- Join our Discord (link TBD)
- Check existing issues and PRs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
