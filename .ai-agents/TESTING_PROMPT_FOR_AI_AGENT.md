# AI Agent Testing Prompt: OpenMemory Autonomous Intelligence System

Copy and paste this prompt to an AI agent to have it test the autonomous intelligence system:

---

## TESTING PROMPT (Copy Everything Below This Line)

---

# Task: Test OpenMemory Autonomous Intelligence System

You are tasked with testing a newly implemented autonomous intelligence system for OpenMemory. This system provides automatic validation, self-correction, proactive warnings, continuous learning, and quality monitoring.

## System Information

**Backend URL**: http://localhost:8080
**Project Name**: TestProject (use this for all tests)
**User ID**: ai-agent-system (default)

## Your Testing Mission

Systematically test all 5 phases of the autonomous intelligence system and report your findings.

---

## Phase 1: Setup & Health Check

### Step 1.1: Verify Backend is Running
```bash
curl http://localhost:8080/health
```

**Expected**: JSON response indicating the server is healthy

### Step 1.2: Create Test Data

First, let's populate the system with some test memories to validate against:

```bash
# Create a test decision
curl -X POST http://localhost:8080/ai-agents/decision \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "TestProject",
    "decision": "Use TypeScript for all backend code",
    "rationale": "TypeScript provides type safety and better developer experience",
    "user_id": "ai-agent-system"
  }'

# Create a test pattern
curl -X POST http://localhost:8080/ai-agents/pattern \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "TestProject",
    "pattern_name": "Error Handling Pattern",
    "description": "Always use try-catch blocks with proper error logging",
    "example": "try { ... } catch (error) { console.error(error); }",
    "user_id": "ai-agent-system"
  }'

# Create a test action (successful)
curl -X POST http://localhost:8080/ai-agents/action \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "TestProject",
    "agent_name": "TestAgent",
    "action": "Implemented authentication with TypeScript",
    "context": "Following architectural decision",
    "outcome": "success",
    "user_id": "ai-agent-system"
  }'

# Create a test action (failed)
curl -X POST http://localhost:8080/ai-agents/action \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "TestProject",
    "agent_name": "TestAgent",
    "action": "Attempted to deploy without tests",
    "context": "Trying to speed up deployment",
    "outcome": "failure",
    "user_id": "ai-agent-system"
  }'

# Create an emotional state
curl -X POST http://localhost:8080/ai-agents/emotion \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "TestProject",
    "agent_name": "TestAgent",
    "feeling": "Confident about the implementation",
    "sentiment": "positive",
    "confidence": 0.85,
    "user_id": "ai-agent-system"
  }'
```

**Expected**: Each request should return `{"success": true, "memory_id": "..."}`

---

## Phase 2: Test Auto-Validation System

### Test 2.1: Consistency Validation
```bash
curl http://localhost:8080/ai-agents/validate/consistency/TestProject
```

**What to check**:
- Response has `success: true`
- `report.issues[]` contains detected issues (if any)
- `report.auto_actions_taken` shows number of automatic corrections
- Look for: contradicting decisions, circular dependencies, broken waypoints, orphaned memories

### Test 2.2: Pattern Effectiveness
```bash
curl http://localhost:8080/ai-agents/validate/effectiveness/TestProject
```

**What to check**:
- Response shows `patterns_analyzed` count
- `report.pattern_results[]` contains effectiveness scores
- Check for patterns categorized as EXCELLENT, GOOD, MEDIOCRE, or FAILING
- `auto_actions_taken` shows automatic reinforcements/downgrades

### Test 2.3: Decision Quality
```bash
curl http://localhost:8080/ai-agents/validate/decisions/TestProject
```

**What to check**:
- Response shows `decisions_assessed` count
- `report.quality_assessments[]` contains quality scores for each decision
- Look for statuses: VALIDATED, SOLID, QUESTIONABLE, IGNORED, REVERSED
- `auto_actions_taken` shows automatic confidence adjustments

### Test 2.4: Comprehensive Validation
```bash
curl http://localhost:8080/ai-agents/validate/TestProject | jq
```

**What to check**:
- Runs all 3 validators in parallel
- Returns `validation.consistency`, `validation.effectiveness`, `validation.decisions`
- `total_auto_actions` summarizes all automatic corrections

---

## Phase 3: Test Self-Correction System

### Test 3.1: Failure Analysis
```bash
curl "http://localhost:8080/ai-agents/analyze/failures/TestProject?lookback_days=30"
```

**What to check**:
- Response shows `failures_analyzed` count
- `report.analyses[]` contains root cause analysis for each failure
- Root causes: PATTERN_FAILURE, DECISION_FAILURE, MISSING_CONTEXT, EXTERNAL_FACTOR, UNKNOWN
- `lessons_created` shows number of lessons learned created
- `auto_actions_taken` includes confidence reductions and warning creations

### Test 3.2: Get Lessons Learned
```bash
curl "http://localhost:8080/ai-agents/lessons/TestProject?limit=10"
```

**What to check**:
- Response contains `lessons[]` array
- Each lesson has `content` with failure analysis and recommendations
- Lessons are ordered by most recent

### Test 3.3: Confidence Auto-Adjustment
```bash
curl -X POST http://localhost:8080/ai-agents/adjust/confidence/TestProject \
  -H "Content-Type: application/json" \
  -d '{"user_id": "ai-agent-system"}'
```

**What to check**:
- Response shows `adjustments_made` count
- `avg_confidence_before` and `avg_confidence_after` show the impact
- `report.adjustments[]` details each adjustment with reasons
- Reasons include: success rate, usage frequency, age penalty, staleness penalty

### Test 3.4: Confidence Distribution
```bash
curl http://localhost:8080/ai-agents/confidence/distribution/TestProject
```

**What to check**:
- Response shows `distribution.total` memory count
- `distribution.by_range` shows breakdown: very_low, low, medium, high, very_high
- `distribution.by_sector` shows average confidence per memory sector
- `distribution.average_overall` gives overall project confidence

### Test 3.5: Memory Consolidation
```bash
curl -X POST http://localhost:8080/ai-agents/consolidate/TestProject \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "ai-agent-system",
    "options": {
      "merge_threshold": 0.85,
      "archive_threshold": 0.15,
      "min_age_days": 7
    }
  }'
```

**What to check**:
- Response shows `memories_before` and `memories_after`
- `memories_merged`, `memories_archived`, `memories_deleted` counts
- `report.actions[]` details each consolidation action

### Test 3.6: Consolidation Stats
```bash
curl http://localhost:8080/ai-agents/consolidation/stats/TestProject
```

**What to check**:
- Response shows `total_memories`, `active_memories`, `archived_memories`
- `stale_memories`, `highly_used` counts
- `by_sector` breakdown

---

## Phase 4: Test Proactive Intelligence

### Test 4.1: Conflict Detection
```bash
curl http://localhost:8080/ai-agents/detect/conflicts/TestProject
```

**What to check**:
- Response shows `conflicts_detected` count
- `report.conflicts[]` contains potential conflicts
- Conflict types: DECISION_CONFLICT, PATTERN_INCOMPATIBILITY, ARCHITECTURAL_MISMATCH, RESOURCE_CONFLICT
- Severity levels: CRITICAL, WARNING, INFO
- Each conflict has `recommendation` and `prevention_action`

### Test 4.2: Blocker Prediction
```bash
curl "http://localhost:8080/ai-agents/predict/blockers/TestProject?lookback_days=30"
```

**What to check**:
- Response shows `blockers_predicted` count
- `high_probability_blockers` shows critical predictions (≥70% probability)
- Blocker types: REPEATED_FAILURE, DEPENDENCY_MISSING, VELOCITY_DROP, COMPLEXITY_SPIKE, KNOWLEDGE_GAP
- Each blocker has `early_warning_signs[]` and `prevention_steps[]`

### Test 4.3: Get Recommendations
```bash
curl -X POST http://localhost:8080/ai-agents/recommend/TestProject \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "ai-agent-system",
    "context": "implementing user authentication"
  }'
```

**What to check**:
- Response shows `recommendations_generated` count
- `high_priority` count for CRITICAL/HIGH priority recommendations
- Recommendation types: PATTERN, DECISION, ACTION, CAUTION
- Each has `confidence` score (0-1), `success_probability`, and `suggested_actions[]`

---

## Phase 5: Test Continuous Learning

### Test 5.1: Extract Success Patterns
```bash
curl -X POST http://localhost:8080/ai-agents/learn/patterns/TestProject \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "ai-agent-system",
    "lookback_days": 30
  }'
```

**What to check**:
- Response shows `patterns_extracted` count
- `high_confidence` count for patterns with ≥80% confidence
- Pattern types: SEQUENCE, APPROACH, TECHNIQUE
- `report.patterns[]` contains extracted patterns with examples
- Each pattern shows `frequency` and `success_rate`

### Test 5.2: Get Learning Statistics
```bash
curl http://localhost:8080/ai-agents/learn/stats/TestProject
```

**What to check**:
- Response shows `extracted_patterns` (auto-learned) count
- `manual_patterns` (manually created) count
- `total_patterns` combines both
- `lessons_learned` count from failure analysis
- `auto_learning_rate` shows % of patterns that were auto-extracted

---

## Phase 6: Test Quality & Monitoring

### Test 6.1: Run Quality Gate
```bash
curl -X POST http://localhost:8080/ai-agents/quality/gate/TestProject \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "ai-agent-system",
    "context": {
      "action": "completed authentication feature"
    }
  }'
```

**What to check**:
- Response shows `passed` (true/false) - gate passed or failed
- `quality_score` (0-100) - overall quality score
- `violations` count broken down by `blocking_violations` and `warning_violations`
- Violation types: ANTI_PATTERN, MISSING_TESTS, NO_DOCUMENTATION, DECISION_NOT_FOLLOWED, DUPLICATE_WORK
- Each violation has `severity`, `title`, `description`, `impact`, `remediation`

### Test 6.2: Get Quality Trends
```bash
curl "http://localhost:8080/ai-agents/quality/trends/TestProject?days=30"
```

**What to check**:
- Response shows `trends.trend[]` array with historical data
- Each entry has `timestamp`, `quality_score`, `violations`, `blocking` counts
- `trends.average_quality` shows average score over period
- `trends.total_reports` shows number of quality checks run

### Test 6.3: Detect Anomalies
```bash
curl http://localhost:8080/ai-agents/detect/anomalies/TestProject
```

**What to check**:
- Response shows `anomalies_detected` count
- `critical` count for high-severity anomalies
- Anomaly types: ACTIVITY_SPIKE, ACTIVITY_DROP, FAILURE_SPIKE, CONFIDENCE_DROP, PATTERN_DEVIATION, MEMORY_GROWTH
- Each anomaly has `metric_value`, `expected_value`, `deviation_percentage`
- `recommendation` provides investigation steps

---

## Phase 7: THE COMPREHENSIVE TEST

### Test 7.1: Run ALL Systems at Once
```bash
curl -X POST http://localhost:8080/ai-agents/autonomous/TestProject \
  -H "Content-Type: application/json" \
  -d '{"user_id": "ai-agent-system"}' | jq
```

**What to check**:
This is the **ultimate test** - it runs all 13 modules in parallel!

Response structure:
```json
{
  "success": true,
  "timestamp": ...,
  "project_name": "TestProject",
  "comprehensive_report": {
    "validation": {
      "consistency": {...},
      "effectiveness": {...},
      "decisions": {...}
    },
    "self_correction": {
      "failures": {...},
      "confidence": {...}
    },
    "proactive": {
      "conflicts": {...},
      "blockers": {...},
      "recommendations": {...}
    },
    "quality": {
      "gate": {...},
      "anomalies": {...}
    }
  },
  "summary": {
    "validation_issues": ...,
    "patterns_analyzed": ...,
    "decisions_assessed": ...,
    "failures_analyzed": ...,
    "confidence_adjustments": ...,
    "conflicts_detected": ...,
    "blockers_predicted": ...,
    "recommendations_generated": ...,
    "quality_score": ...,
    "anomalies_detected": ...
  }
}
```

**Verify**:
- All sections present: validation, self_correction, proactive, quality
- Summary has metrics from all 13 modules
- No errors in any subsystem
- Execution time is reasonable (should complete in seconds due to parallel execution)

### Test 7.2: Extract and Display Summary
```bash
curl -X POST http://localhost:8080/ai-agents/autonomous/TestProject \
  -H "Content-Type: application/json" \
  -d '{"user_id": "ai-agent-system"}' | jq '.summary'
```

**What to check**:
This shows a clean summary of all autonomous intelligence findings.

---

## Your Testing Report

After completing all tests, provide a report with:

### 1. Test Results Summary
- ✅ or ❌ for each phase tested
- Total endpoints tested
- Any errors encountered

### 2. Autonomous Intelligence Metrics
From the comprehensive test (Phase 7), report:
- Validation issues found
- Patterns analyzed and their effectiveness
- Decisions assessed and quality scores
- Failures analyzed and lessons learned
- Confidence adjustments made
- Conflicts detected (if any)
- Blockers predicted (if any)
- Recommendations generated
- Quality score (0-100)
- Anomalies detected (if any)

### 3. Auto-Actions Performed
Total count of automatic actions across all systems:
- Confidence boosts/reductions
- Memory merges/archives
- Warning creations
- Pattern extractions
- Quality gate violations

### 4. System Health Assessment
- Overall assessment: EXCELLENT / GOOD / NEEDS ATTENTION / FAILING
- Key strengths observed
- Issues requiring attention (if any)
- Recommendations for improvement

### 5. Performance Observations
- Response times for each endpoint
- Comprehensive endpoint execution time
- Any timeouts or slow responses

---

## Expected Behavior

**Healthy System Should Show**:
- ✅ All endpoints return `success: true`
- ✅ Comprehensive endpoint completes in <10 seconds
- ✅ Auto-actions are performed (counts > 0 where applicable)
- ✅ Quality score ≥ 70
- ✅ Clear, actionable recommendations
- ✅ Proper JSON structure in all responses

**Common Scenarios**:
- Few validation issues on fresh test data (expected)
- Low pattern effectiveness if limited test data (expected)
- Some decisions may be "IGNORED" if no follow-up actions (expected)
- Quality gate may have warnings about test coverage (expected)
- Anomalies may be zero if no unusual activity (expected)

---

## Troubleshooting

If you encounter errors:

1. **Connection refused**: Backend not running - start with `npm run dev` in backend directory
2. **404 errors**: Endpoint path incorrect - double-check URL
3. **500 errors**: Check backend console logs for details
4. **Empty results**: Not enough test data - create more test memories
5. **Timeout**: Comprehensive endpoint taking too long - test individual endpoints first

---

## Success Criteria

The test is successful if:
- ✅ All 20+ endpoints respond successfully
- ✅ Comprehensive endpoint returns complete report with all sections
- ✅ Auto-actions are performed (indicated by non-zero counts)
- ✅ No server errors (500s)
- ✅ Response times are acceptable (<10s for comprehensive)
- ✅ Data structures match expected format

---

Begin your testing now and provide a comprehensive report of your findings!
