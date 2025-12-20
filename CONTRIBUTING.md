# Contributing to OpenMemory

We love your input! We want to make contributing to OpenMemory as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html)

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](https://github.com/CaviraOSS/OpenMemory/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/CaviraOSS/OpenMemory/issues/new).

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People _love_ thorough bug reports. I'm not even kidding.

## Development Setup

### Prerequisites

- Node.js 21+ and npm
- Python 3.8+ (for Python SDK development)
- Git
- Docker (optional, for containerized development)

### Backend/Node SDK Development

```bash
# Clone the repository
git clone https://github.com/CaviraOSS/OpenMemory.git
cd openmemory

# Install dependencies
cd packages/openmemory-js
npm install

# Start development server
npm run dev

# Run Omnibus Test (Comprehensive Parity Check)
npx tsx tests/test_omnibus.ts
```

### Python SDK Development

```bash
# Navigate to Python SDK
cd packages/openmemory-py

# Install development dependencies
pip install -e .[dev]

# Run Omnibus Test
pytest tests/test_omnibus.py
```



### Docker Development

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in development mode
docker-compose -f docker-compose.dev.yml up
```

## Development Guidelines

### Code Style

#### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- 2-space indentation
- Semicolons required

#### Python

- Follow PEP 8 style guide
- Use black for formatting
- 4-space indentation
- Type hints for all public functions
- Docstrings for all modules, classes, and functions

### Commit Messages

Use conventional commits format:

```
type(scope): description

[optional body]

[optional footer(s)]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(embedding): add Google Gemini embedding provider
fix(database): resolve memory leak in connection pooling
docs(api): update HSG endpoint documentation
```

### Testing

#### Backend Tests

#### Node.js SDK / Backend Tests

```bash
cd packages/openmemory-js
npx tsx tests/test_omnibus.ts   # Run Omnibus Test
```

#### Python SDK Tests

```bash
cd packages/openmemory-py
python -m pytest tests/test_omnibus.py  # Run Omnibus Test
```

### Architecture Guidelines

#### HSG (Hybrid Sector Graph) Development

When working on HSG features:

1. **Sector Classification**: Ensure new content types are properly classified
2. **Waypoint Management**: Consider graph traversal implications
3. **Memory Decay**: Account for temporal aspects in new features
4. **Cross-Sector Queries**: Test functionality across all brain sectors

#### Database Changes

1. Create migration scripts for schema changes
2. Test with existing data
3. Update both TypeScript types and documentation
4. Consider impact on all embedding providers

#### API Changes

1. Maintain backwards compatibility when possible
2. Version new endpoints appropriately
3. Update OpenAPI documentation
4. Test with all SDK implementations

## Feature Development Process

### 1. Design Phase

- Create GitHub issue with detailed proposal
- Discuss architecture implications
- Consider HSG impact and sector routing
- Plan testing strategy

### 2. Implementation Phase

- Create feature branch from `main`
- Implement core functionality
- Add comprehensive tests
- Update documentation

### 3. Review Phase

- Submit pull request
- Address code review feedback
- Ensure all tests pass
- Update changelog

### 4. Integration Phase

- Merge to main branch
- Deploy to staging environment
- Verify functionality
- Update release notes

## Embedding Provider Development

When adding new embedding providers:

1. **Provider Interface**: Implement the standard embedding interface
2. **Error Handling**: Add appropriate fallback mechanisms
3. **Configuration**: Add provider-specific configuration options
4. **Testing**: Create comprehensive tests for the new provider
5. **Documentation**: Update configuration documentation
6. **Examples**: Add examples demonstrating the new provider

Example provider structure:

```typescript
interface EmbeddingProvider {
  name: string;
  embed(text: string, options?: any): Promise<number[]>;
  getDimensions(): number;
  isAvailable(): Promise<boolean>;
}
```

## Documentation

### API Documentation

- Update OpenAPI specs for new endpoints
- Include request/response examples
- Document error conditions
- Update SDK documentation

### Code Documentation

- Use TSDoc for TypeScript code
- Use docstrings for Python code
- Include usage examples
- Document complex algorithms

### User Documentation

- Update README files
- Create tutorial content
- Update example code
- Document configuration options

## Performance Considerations

### Backend Performance

- Profile database queries
- Monitor memory usage
- Test with large datasets
- Consider async operations

### SDK Performance

- Minimize bundle size
- Optimize API calls
- Consider caching strategies
- Test network conditions

## Security Guidelines

### Input Validation

- Sanitize all user inputs
- Validate API parameters
- Check authentication tokens
- Rate limit requests

### Data Protection

- Encrypt sensitive data
- Secure API endpoints
- Validate file uploads
- Monitor access patterns

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Checklist

1. Update version numbers
2. Update CHANGELOG.md
3. Run full test suite
4. Build all packages
5. Create GitHub release
6. Deploy to production
7. Update documentation

## Community

### Getting Help

- GitHub Discussions for questions
- GitHub Issues for bug reports
- Discord server for real-time chat
- Stack Overflow with `openmemory` tag

### Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Recognition

Contributors will be recognized in:

- CONTRIBUTORS.md file
- GitHub contributors page
- Release notes
- Project documentation

Thank you for contributing to OpenMemory! 🧠✨
