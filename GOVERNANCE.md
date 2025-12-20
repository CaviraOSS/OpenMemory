# OpenMemory Governance Model

_Last updated: 2025-10-18_

---

## 1. Overview

**OpenMemory** is an open-source, community-driven project under the umbrella of **CaviraOSS**.  
This document defines how decisions are made, who has authority within the project, and how contributors can grow into maintainers.

Our goal is to ensure transparency, trust, and long-term sustainability for all contributors and users.

---

## 2. Guiding Principles

1. **Openness** — All major discussions, decisions, and changes happen publicly.
2. **Meritocracy** — Influence is earned through consistent, meaningful contributions.
3. **Accountability** — Maintainers act in the project’s best interest, not personal gain.
4. **Empowerment** — Contributors are encouraged to take initiative and propose improvements.
5. **Neutrality** — OpenMemory remains vendor-neutral and framework-agnostic.

---

## 3. Roles and Responsibilities

| Role                            | Description                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Contributor**                 | Anyone who submits code, documentation, or feedback through issues or pull requests.                                  |
| **Reviewer**                    | Contributors with a proven track record who review pull requests for correctness, clarity, and quality.               |
| **Maintainer**                  | Trusted developers with merge rights and responsibility for a major subsystem (e.g., backend, JS SDK, or embeddings). |
| **Lead Maintainer / Core Team** | Oversees project vision, approves roadmap changes, and manages releases.                                              |
| **Advisor (optional)**          | Experienced external contributors providing technical or strategic input.                                             |

---

## 4. Decision Process

- **Minor changes** (typos, bugfixes): can be merged by any maintainer after one approval.
- **Moderate changes** (new APIs, refactors): require two maintainers’ approval.
- **Major proposals** (architecture redesign, deprecation, rebrand): discussed via a **Request for Comment (RFC)** issue and voted on by the core team.

Each maintainer has one vote.  
A proposal passes with **majority approval (≥60%)**.

---

## 5. Project Structure

OpenMemory is divided into modular components:

| Module      | Lead              | Description                               |
| ----------- | ----------------- | ----------------------------------------- |
| `packages/openmemory-js` | Core Team / JS Maintainer | Memory Engine + Node.js SDK      |
| `packages/openmemory-py` | Python Maintainer         | Python SDK                       |
| `examples/`             | Community                 | Reference implementations & demos|

Each module may evolve independently as long as compatibility with the API contracts is maintained.

---

## 6. Roadmap and Releases

- Minor releases every **3–4 day**.
- Major releases every **3–6 weeks**.
- Every release must:
  - Update `CHANGELOG.md`
  - Pass automated CI/CD checks
  - Be signed off by two maintainers

---

## 7. Conflict Resolution

If disagreements arise:

1. Seek consensus via respectful discussion.
2. If unresolved, escalate to core maintainers for mediation.
3. Persistent issues may be put to a formal vote by the core team.

Maintainers must act in good faith and prioritize project health.

---

## 8. Adding New Maintainers

To become a maintainer:

1. Be an active contributor for at least **3 months**.
2. Have at least **3+ approved PRs** merged.
3. Be nominated by an existing maintainer.
4. Be confirmed by majority vote.

Inactive maintainers (>90 days no activity) may be transitioned to **emeritus status**.

---

## 9. Amendments

This governance document may be amended through a pull request approved by **two-thirds of the core maintainers**.

---

### Current Core Team (2025)

| Name          | Role              | Area                        |
| ------------- | ----------------- | --------------------------- |
| **nullure**   | Lead Maintainer   | Architecture & Vision       |
| **CaviraOss** | Organization      | Infrastructure & Governance |
| _(vacant)_    | Python Maintainer | SDK & API Sync              |
| _(vacant)_    | JS Maintainer     | JS SDK, npm releases        |

---

_This document ensures OpenMemory remains a transparent, open, and long-lived project — open to contributors worldwide. Document cannot be edited without nullure's approval and nullure owns all rights to the project OpenMemory_
