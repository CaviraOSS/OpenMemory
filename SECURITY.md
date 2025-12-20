# Security Policy

## Reporting a Vulnerability

We take the security of OpenMemory seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send an email to bob@holacorp.net
2. **GitHub Security Advisories**: Use the [GitHub Security Advisory](https://github.com/CaviraOSS/OpenMemory/security/advisories) feature
3. **Private disclosure**: Contact maintainers directly for sensitive issues

### What to Include

Please include the following information in your report:

- **Description**: A clear description of the vulnerability
- **Impact**: The potential impact of the vulnerability
- **Reproduction**: Step-by-step instructions to reproduce the issue
- **Affected versions**: Which versions of OpenMemory are affected
- **Suggested fix**: If you have suggestions for how to fix the issue
- **Your contact information**: So we can follow up with questions

### Response Timeline

We aim to respond to security reports within the following timeframes:

- **Initial response**: Within 48 hours
- **Assessment completion**: Within 7 days
- **Fix development**: Within 30 days (depending on complexity)
- **Public disclosure**: After fix is released and users have time to update

### Security Update Process

1. **Vulnerability confirmed**: We verify the reported vulnerability
2. **Fix development**: We develop and test a security fix
3. **Security advisory**: We prepare a security advisory
4. **Coordinated disclosure**: We release the fix and advisory together
5. **CVE assignment**: We request a CVE if applicable

## Security Best Practices

### For Users

#### Server Security

- **Authentication**: Always use authentication in production
- **HTTPS**: Use HTTPS/TLS for all communications
- **Network isolation**: Run OpenMemory behind a firewall
- **Regular updates**: Keep OpenMemory updated to the latest version
- **Environment variables**: Store sensitive configuration in environment variables
- **Access control**: Limit access to the OpenMemory server

#### API Key Security

- **Secure storage**: Store embedding provider API keys securely
- **Rotation**: Rotate API keys regularly
- **Least privilege**: Use API keys with minimal required permissions
- **Monitoring**: Monitor API key usage for anomalies

#### Data Protection

- **Input validation**: Validate all inputs before storing
- **Sensitive data**: Avoid storing sensitive personal information
- **Backup security**: Secure database backups
- **Audit logging**: Enable audit logging for security events

### For Developers

#### Code Security

- **Input sanitization**: Sanitize all user inputs
- **SQL injection prevention**: Use parameterized queries
- **XSS prevention**: Escape output appropriately
- **CSRF protection**: Implement CSRF protection
- **Rate limiting**: Implement rate limiting on API endpoints

#### Dependency Security

- **Regular updates**: Keep dependencies updated
- **Vulnerability scanning**: Regularly scan for vulnerable dependencies
- **Minimal dependencies**: Use minimal required dependencies
- **License compliance**: Ensure dependency licenses are compatible

#### Development Security

- **Secure coding practices**: Follow secure coding guidelines
- **Code review**: Require security-focused code reviews
- **Static analysis**: Use static analysis tools
- **Secrets management**: Never commit secrets to version control

## Questions?

If you have any questions about this security policy, please contact us at security@cavira.app or create a GitHub discussion.

Thank you for helping keep OpenMemory and our users safe!
