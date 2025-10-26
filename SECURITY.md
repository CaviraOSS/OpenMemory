# Security Policy

## Supported Versions

We actively support the following versions of OpenMemory with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

We take the security of OpenMemory seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send an email to bob@holacorp.net
2. **GitHub Security Advisories**: Use the [GitHub Security Advisory](https://github.com/nullure/openmemory/security/advisories) feature
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

## Known Security Considerations

### Data Privacy
- **Memory content**: Memory contents are stored unencrypted by default
- **Embedding vectors**: Vector embeddings may contain sensitive information
- **Logs**: Server logs may contain user inputs
- **Metadata**: Memory metadata includes timestamps and user identifiers

### Network Security
- **API exposure**: The REST API is exposed on configured port
- **CORS**: CORS is enabled by default for development
- **Authentication**: Authentication is optional by default
- **Rate limiting**: No built-in rate limiting by default

### Database Security
- **SQLite file**: Database is stored as a file on disk
- **Permissions**: File system permissions control database access
- **Encryption**: Database encryption is not enabled by default
- **Backups**: Database backups contain all stored data

## Security Configuration

### Production Deployment

```yaml
# Example secure configuration
environment:
  - NODE_ENV=production
  - AUTH_KEY=your-secure-auth-key
  - CORS_ORIGIN=https://yourdomain.com
  - RATE_LIMIT_MAX=100
  - RATE_LIMIT_WINDOW=900000
```

### Environment Variables

```bash
# Authentication
AUTH_KEY=generate-a-secure-random-key

# API Keys (store securely)
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key

# Network security
CORS_ORIGIN=https://yourdomain.com
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com

# Database encryption (if available)
DB_ENCRYPTION_KEY=your-database-encryption-key
```

### Reverse Proxy Configuration

```nginx
# Example Nginx configuration
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=api burst=10 nodelay;
    }
}
```

## Security Monitoring

### Recommended Monitoring

- **Failed authentication attempts**: Monitor for brute force attacks
- **Unusual API usage patterns**: Detect potential abuse
- **Large memory uploads**: Monitor for DoS attempts
- **Error rates**: High error rates may indicate attacks
- **Database growth**: Unexpected growth may indicate issues

### Logging Security Events

```javascript
// Example security event logging
const securityEvents = [
  'authentication_failure',
  'rate_limit_exceeded', 
  'invalid_input_detected',
  'large_payload_received',
  'suspicious_query_pattern'
];
```

## Incident Response

### Security Incident Response Plan

1. **Detection**: Identify the security incident
2. **Assessment**: Evaluate the scope and impact
3. **Containment**: Limit the spread of the incident
4. **Eradication**: Remove the threat from the system
5. **Recovery**: Restore normal operations
6. **Lessons learned**: Document and improve processes

### Emergency Contacts

- **Security team**: security@openmemory.dev
- **Maintainers**: Available via GitHub
- **Community**: Discord server for urgent community issues

## Compliance

### Data Protection Regulations

OpenMemory deployments should consider:

- **GDPR**: European data protection regulation
- **CCPA**: California consumer privacy act
- **HIPAA**: Healthcare data protection (if applicable)
- **SOC 2**: Security and compliance framework

### Security Standards

We aim to align with:

- **OWASP Top 10**: Web application security risks
- **NIST Cybersecurity Framework**: Security best practices
- **ISO 27001**: Information security management
- **CIS Controls**: Critical security controls

## Security Tools

### Recommended Security Tools

- **Static analysis**: ESLint security rules, Bandit (Python)
- **Dependency scanning**: npm audit, Safety (Python)
- **Container scanning**: Docker security scanning
- **Network scanning**: Nmap, OpenVAS
- **Web application scanning**: OWASP ZAP

### Security Testing

```bash
# Example security testing commands
npm audit                           # Check for vulnerable dependencies
npx eslint --ext .js,.ts --config .eslintrc.security.js src/
python -m safety check             # Python dependency vulnerability check
docker scan openmemory:latest      # Container vulnerability scan
```

## Updates and Patches

### Security Update Notifications

- **GitHub**: Watch the repository for security updates
- **RSS/Atom**: Subscribe to release feeds
- **Email**: Security mailing list (when available)
- **Discord**: Security announcements channel

### Update Process

1. **Review changelog**: Check for security-related changes
2. **Test in staging**: Test updates in a staging environment
3. **Backup data**: Backup your database before updating
4. **Deploy update**: Deploy to production
5. **Verify functionality**: Ensure the update worked correctly
6. **Monitor**: Monitor for any issues after the update

---

## Questions?

If you have any questions about this security policy, please contact us at security@openmemory.dev or create a GitHub discussion.

Thank you for helping keep OpenMemory and our users safe!
