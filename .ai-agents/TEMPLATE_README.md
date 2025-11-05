# TEMPLATE: Project Name

> **Instructions**: Replace all TEMPLATE markers with your actual project information. This README.md goes in your project root (not in .ai-agents folder).

## Project Overview

[Provide a clear, concise description of what your project does and its main purpose]

**Example**: "A microservices-based resume optimization platform that uses AI to analyze, grade, and optimize resumes for ATS systems."

---

## System Architecture

### Architecture Type
- [ ] Microservices
- [ ] Monolithic
- [ ] Serverless
- [ ] Modular Monolith
- [ ] Other: [specify]

### Architecture Diagram

[If you have a diagram, reference it here or describe your architecture]

**Example**:
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│  Services   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  Event Bus   │     │  Database   │
                    └──────────────┘     └─────────────┘
```

---

## Technology Stack

### Backend
- **Language**: [e.g., Python 3.11, Node.js 18, Java 17, Go 1.21]
- **Framework**: [e.g., FastAPI, Express, Spring Boot, Gin]
- **Database**: [e.g., PostgreSQL, MongoDB, MySQL, SQLite]
- **Cache**: [e.g., Redis, Memcached] (if applicable)
- **Message Queue**: [e.g., RabbitMQ, Kafka, AWS SQS] (if applicable)

### Frontend (if applicable)
- **Framework**: [e.g., React 18, Vue 3, Angular 16, Svelte]
- **Language**: [e.g., TypeScript, JavaScript]
- **State Management**: [e.g., Redux, Zustand, Pinia]
- **Styling**: [e.g., Tailwind CSS, Material-UI, Styled Components]

### Infrastructure
- **Containerization**: [e.g., Docker, Podman]
- **Orchestration**: [e.g., Docker Compose, Kubernetes] (if applicable)
- **Cloud Provider**: [e.g., AWS, GCP, Azure, None (local only)]
- **IaC**: [e.g., Terraform, CloudFormation] (if applicable)

### Development Tools
- **Testing**: [e.g., pytest, Jest, JUnit]
- **Linting**: [e.g., ESLint, Pylint, golangci-lint]
- **CI/CD**: [e.g., GitHub Actions, GitLab CI, Jenkins] (if applicable)

---

## Component Catalog

> **Instructions**: List all major components/services in your system. For each component, describe its purpose, responsibilities, dependencies, and key interfaces.

### TEMPLATE: Component/Service Name 1

**Purpose**: What this component does in one sentence

**Responsibilities**:
- Responsibility 1
- Responsibility 2
- Responsibility 3

**Dependencies**:
- Component/Service Name 2
- Component/Service Name 3
- External Service (if applicable)

**API Endpoints** (if applicable):
- `POST /api/endpoint1` - Description
- `GET /api/endpoint2` - Description

**Events Emitted** (if event-driven):
- `event.name` - When this event is triggered

**Events Consumed** (if event-driven):
- `other.event` - What this component does when it receives this event

---

### TEMPLATE: Component/Service Name 2

[Repeat the same structure for each component]

---

## Component Dependencies Graph

> **Instructions**: Show which components depend on which. This helps the AI understand implementation order.

```
TEMPLATE:

Component A (no dependencies)
    ├─▶ Component B (depends on A)
    │       └─▶ Component D (depends on B)
    └─▶ Component C (depends on A)
            └─▶ Component D (depends on C)
```

**Critical Path**: Components that must be implemented first: [List them]

---

## Workflows

> **Instructions**: Describe the main user workflows or system processes. These will be implemented as part of the project.

### TEMPLATE: Workflow Name 1

**Description**: Brief description of what this workflow accomplishes

**Steps**:
1. **Step 1 Name** (Handled by: Component X)
   - Description of what happens
   - Input: What data is needed
   - Output: What data is produced

2. **Step 2 Name** (Handled by: Component Y)
   - Description of what happens
   - Input: Output from Step 1
   - Output: What data is produced

3. **Step 3 Name** (Handled by: Component Z)
   - Description of what happens
   - Input: Output from Step 2
   - Output: Final result

**Example**: 
```
User Registration Workflow:
1. Submit Registration Form (Frontend) → User data
2. Validate & Create Account (Auth Service) → User ID
3. Send Verification Email (Email Service) → Email sent
4. Create User Profile (Profile Service) → Profile created
```

---

### TEMPLATE: Workflow Name 2

[Repeat for each major workflow]

---

## Project Structure

```
TEMPLATE:

project-root/
├── .ai-agents/                  # AI Agent system configuration
│   ├── agent-roles.json
│   ├── context-manager.json
│   ├── workflow-tracker.json
│   ├── project-state.json       # Auto-generated
│   ├── AUTONOMOUS_MODE.md
│   ├── detect-state.py
│   └── QUICK_START.md
├── src/                         # Source code
│   ├── components/              # Your components/services
│   ├── common/                  # Shared code
│   └── config/                  # Configuration
├── tests/                       # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── infrastructure/              # Deployment configs
│   ├── local/
│   └── cloud/
├── docs/                        # Documentation
├── README.md                    # This file
└── [other project files]
```

---

## Development Phases

> **Instructions**: Break your project development into phases. This helps the AI know what to build first.

### Phase 1: Foundation & Setup (0-15%)
**Goal**: Set up project structure and shared utilities

**Tasks**:
- [ ] Create project directory structure
- [ ] Set up development environment
- [ ] Implement shared libraries/utilities
- [ ] Set up testing framework
- [ ] Configure linting and code quality tools

**Deliverables**: Project skeleton, shared utilities ready

---

### Phase 2: Core Infrastructure (15-30%)
**Goal**: Build foundational services that others depend on

**Tasks**:
- [ ] Implement [Component with no dependencies]
- [ ] Implement [Component with no dependencies]
- [ ] Set up database schema
- [ ] Implement configuration management

**Deliverables**: Core infrastructure services operational

---

### Phase 3: Business Logic (30-60%)
**Goal**: Implement main business features

**Tasks**:
- [ ] Implement [Business Component 1]
- [ ] Implement [Business Component 2]
- [ ] Implement [Business Component 3]
- [ ] Add comprehensive unit tests

**Deliverables**: All major features implemented

---

### Phase 4: Integration & Workflows (60-80%)
**Goal**: Connect all components and implement workflows

**Tasks**:
- [ ] Implement [Workflow 1]
- [ ] Implement [Workflow 2]
- [ ] Add integration tests
- [ ] Implement error handling and recovery

**Deliverables**: End-to-end workflows functional

---

### Phase 5: Deployment & Polish (80-95%)
**Goal**: Prepare for deployment

**Tasks**:
- [ ] Create deployment configurations
- [ ] Set up CI/CD pipeline
- [ ] Deploy to staging/test environment
- [ ] Performance optimization
- [ ] Security hardening

**Deliverables**: Production-ready deployment

---

### Phase 6: Documentation & Finalization (95-100%)
**Goal**: Complete documentation and final polish

**Tasks**:
- [ ] Complete API documentation
- [ ] Write user guides
- [ ] Final bug fixes
- [ ] Code cleanup and optimization

**Deliverables**: Fully documented, production-ready system

---

## Getting Started (Bootstrap Section)

> **CRITICAL**: Include this exact bootstrap detection code. This allows the AI to detect whether to initialize or resume.

```python
# AI Agent Bootstrap Detection
# This code runs automatically when an AI agent starts work

import json
from pathlib import Path

# Check if project-state.json exists
state_file = Path(".ai-agents/project-state.json")

if state_file.exists():
    # RESUME MODE - Continue from previous state
    print("🔄 RESUME MODE: Loading project state...")
    with open(state_file, 'r') as f:
        state = json.load(f)
    
    print(f"Current Phase: {state['project_metadata']['current_phase']}")
    print(f"Progress: {state['project_metadata']['progress_percentage']}%")
    print(f"Next Tasks: {len(state.get('next_recommended_tasks', []))} tasks pending")
    
    # AI Agent: Load state and continue with next_recommended_tasks
    
else:
    # INITIALIZE MODE - Start fresh
    print("🆕 INITIALIZE MODE: Starting fresh project...")
    print("Beginning Phase 1: Foundation & Setup")
    
    # AI Agent: Start with Phase 1 tasks defined above
    # 1. Create project directory structure
    # 2. Set up development environment
    # 3. Implement shared libraries
    # etc.
```

---

## Component Implementation Details

> **Instructions**: Provide implementation details for each component. This helps the AI know what to build.

### TEMPLATE: Component Name

**File Structure**:
```
component_name/
├── __init__.py (or index.ts, etc.)
├── main.py (or main.ts, main.go, etc.)
├── models.py (or models.ts)
├── api.py (or routes.ts, handlers.go)
├── services.py (or services.ts)
└── tests/
    ├── test_api.py
    └── test_services.py
```

**Key Classes/Functions**:
- `ClassName1`: Description of what it does
- `ClassName2`: Description of what it does
- `function_name()`: Description of what it does

**Database Schema** (if applicable):
```sql
CREATE TABLE table_name (
    id SERIAL PRIMARY KEY,
    field1 VARCHAR(255) NOT NULL,
    field2 INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Configuration**:
- Environment Variables: `VAR_NAME` - description
- Configuration Files: `config.yaml` - description

---

## Event System (if applicable)

> **Instructions**: If using event-driven architecture, define all events here. Remove this section if not applicable.

### Event Types

| Event Name | Description | Payload | Emitted By | Consumed By |
|------------|-------------|---------|------------|-------------|
| `component.action` | Description | `{field: type}` | Component A | Component B, C |

**Example**:
| Event Name | Description | Payload | Emitted By | Consumed By |
|------------|-------------|---------|------------|-------------|
| `user.created` | New user registered | `{user_id, email}` | Auth Service | Email Service, Profile Service |

---

## API Documentation (if applicable)

> **Instructions**: Document your main API endpoints

### Authentication
- **Method**: [e.g., JWT, OAuth2, API Keys, None]
- **Headers Required**: [e.g., `Authorization: Bearer <token>`]

### Endpoints

#### TEMPLATE: Endpoint Name
- **URL**: `/api/v1/endpoint`
- **Method**: `POST`
- **Description**: What this endpoint does

**Request Body**:
```json
{
    "field1": "string",
    "field2": 123
}
```

**Response** (200 OK):
```json
{
    "id": "string",
    "status": "success",
    "data": {}
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Testing Strategy

### Unit Tests
- **Location**: `tests/unit/`
- **Coverage Target**: 80%+
- **Run Command**: `[e.g., pytest tests/unit/]`

### Integration Tests
- **Location**: `tests/integration/`
- **What They Test**: Component interactions
- **Run Command**: `[e.g., pytest tests/integration/]`

### End-to-End Tests (if applicable)
- **Location**: `tests/e2e/`
- **What They Test**: Complete workflows
- **Run Command**: `[e.g., pytest tests/e2e/]`

---

## Configuration

### Environment Variables

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `DATABASE_URL` | Database connection string | Yes | - | `postgresql://user:pass@localhost/db` |
| `API_KEY` | External API key | No | - | `abc123` |

### Configuration Files
- `config/dev.yaml` - Development configuration
- `config/prod.yaml` - Production configuration

---

## Deployment

### Local Development
```bash
# Instructions for running locally
docker-compose up -d
# or
npm run dev
# or
python main.py
```

### Staging/Production (if applicable)
[Describe deployment process]

---

## Contributing (Optional)

[If this is a team project, describe contribution guidelines]

---

## License (Optional)

[Specify license if applicable]

---

## Additional Notes

[Any other important information the AI should know]

---

## ⚠️ Important for AI Agents

When working on this project:

1. **Always start with**: `Read README.md`
2. **Check bootstrap protocol**: Determine if INITIALIZE or RESUME mode
3. **Follow phase order**: Don't skip phases
4. **Respect dependencies**: Don't implement Component B before Component A if B depends on A
5. **Update state**: Always update `.ai-agents/project-state.json` after completing work
6. **Work autonomously**: Never ask for permission, just execute next_recommended_tasks
7. **Test as you go**: Add tests for each component

---

**This README.md is designed to work with the AI Agent Autonomous Development System**
