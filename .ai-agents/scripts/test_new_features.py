#!/usr/bin/env python3
"""
Test script for new deep integration features
Tests: Emotional memory, waypoints, pattern detection, smart reinforcement
"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient
import json

def test_emotional_memory(client):
    """Test emotional memory integration"""
    print("\n" + "="*60)
    print("TESTING EMOTIONAL MEMORY")
    print("="*60)

    # Record various emotions
    emotions = [
        {
            "agent_name": "backend_developer",
            "feeling": "Very confident about the authentication implementation",
            "sentiment": "confident",
            "confidence": 0.95,
            "context": "Implemented JWT auth with proper error handling"
        },
        {
            "agent_name": "backend_developer",
            "feeling": "Stuck on database connection pooling",
            "sentiment": "frustrated",
            "confidence": 0.30,
            "context": "Multiple attempts to configure pool failed"
        },
        {
            "agent_name": "frontend_developer",
            "feeling": "This UI component design feels clean and maintainable",
            "sentiment": "positive",
            "confidence": 0.85,
            "context": "Created reusable Button component with proper TypeScript types"
        },
    ]

    for emo in emotions:
        result = client.record_emotion(**emo)
        print(f"✓ Recorded: {emo['feeling'][:50]}... (ID: {result['memory_id']})")

    # Get emotional timeline
    print("\n--- Emotional Timeline ---")
    timeline = client.get_emotional_timeline(limit=10)
    for i, emotion in enumerate(timeline, 1):
        sentiment = emotion.get('metadata', {}).get('sentiment', 'unknown')
        confidence = emotion.get('metadata', {}).get('confidence', 0.0)
        content = emotion.get('content', '')[:60]
        print(f"{i}. [{sentiment.upper()}] Confidence: {confidence:.2f}")
        print(f"   {content}...")

    # Analyze sentiment trends
    print("\n--- Sentiment Analysis ---")
    trends = client.analyze_sentiment_trends()
    print(f"Overall Trend: {trends.get('trend', 'unknown').upper()}")
    print(f"Average Confidence: {trends.get('average_confidence', 0.0):.2f}")
    print(f"Positive: {trends.get('positive_count', 0)}, Negative: {trends.get('negative_count', 0)}, Neutral: {trends.get('neutral_count', 0)}")

def test_waypoint_graphs(client):
    """Test waypoint graph integration"""
    print("\n" + "="*60)
    print("TESTING WAYPOINT GRAPHS")
    print("="*60)

    # Create a decision
    decision = client.record_decision(
        decision="Use PostgreSQL for primary database",
        rationale="Better support for complex queries and transactions",
        alternatives="SQLite, MongoDB",
        consequences="Requires separate database server"
    )
    decision_id = decision['memory_id']
    print(f"✓ Created decision: {decision_id}")

    # Create a pattern that implements the decision
    pattern = client.store_pattern(
        pattern_name="PostgreSQL Connection Pooling",
        description="Efficient connection management for PostgreSQL using pg.Pool",
        example="const pool = new Pool({ host, port, database, user, password, max: 20 })"
    )
    pattern_id = pattern['memory_id']
    print(f"✓ Created pattern: {pattern_id}")

    # Link decision → pattern
    link1 = client.link_memories(
        source_memory_id=decision_id,
        target_memory_id=pattern_id,
        weight=0.90,
        relationship="led_to"
    )
    print(f"✓ Linked: decision → pattern (weight: 0.90)")

    # Record actions that use the pattern
    action1 = client.record_action(
        agent_name="database_engineer",
        action="Implemented PostgreSQL connection pool in db.ts",
        context="Created connection pool with proper error handling",
        outcome="success",
        related_decision=decision_id,
        used_pattern=pattern_id
    )
    action1_id = action1['memory_id']
    print(f"✓ Created action with auto-links: {action1_id}")
    print(f"  Links: {action1.get('links', {})}")

    # Get the memory graph
    print("\n--- Memory Graph Traversal ---")
    graph = client.get_memory_graph(decision_id, depth=3)
    print(f"Root: {decision_id}")
    print(f"Total waypoints: {graph.get('count', 0)}")

    waypoints = graph.get('waypoints', [])
    for wp in waypoints[:5]:  # Show first 5
        depth = wp.get('depth', 0)
        content = wp.get('content', '')[:50]
        sector = wp.get('primary_sector', 'unknown')
        print(f"  {'  ' * depth}→ [{sector}] {content}...")

    # Trace decision to actions
    print("\n--- Decision Trace ---")
    chain = client.trace_decision_to_actions(decision_id)
    print(f"Full chain from decision to outcomes:")
    for item in chain[:5]:
        sector = item.get('primary_sector', 'unknown')
        content = item.get('content', '')[:60]
        print(f"  • [{sector}] {content}...")

def test_pattern_detection(client):
    """Test automatic pattern detection"""
    print("\n" + "="*60)
    print("TESTING AUTOMATIC PATTERN DETECTION")
    print("="*60)

    # Record some repeated action sequences
    sequences = [
        # Sequence 1: API endpoint pattern (repeated 4 times)
        ["Created REST endpoint for users", "Added input validation", "Implemented error handling"],
        ["Created REST endpoint for posts", "Added input validation", "Implemented error handling"],
        ["Created REST endpoint for comments", "Added input validation", "Implemented error handling"],
        ["Created REST endpoint for auth", "Added input validation", "Implemented error handling"],

        # Sequence 2: Component pattern (repeated 3 times)
        ["Created React component", "Added TypeScript types", "Wrote unit tests"],
        ["Created React component", "Added TypeScript types", "Wrote unit tests"],
        ["Created React component", "Added TypeScript types", "Wrote unit tests"],
    ]

    print("Recording action sequences...")
    for seq in sequences:
        for action in seq:
            client.record_action(
                agent_name="full_stack_developer",
                action=action,
                context="Building application features",
                outcome="success"
            )
    print(f"✓ Recorded {sum(len(s) for s in sequences)} actions")

    # Run pattern detection
    print("\n--- Running Pattern Detection ---")
    detected = client.detect_patterns(
        lookback_days=7,
        min_frequency=3
    )

    print(f"Detected {len(detected)} patterns:")
    for pattern in detected:
        print(f"\n✓ {pattern['pattern_name']}")
        print(f"  Frequency: {pattern['frequency']} times")
        print(f"  Memory ID: {pattern['memory_id']}")

def test_smart_reinforcement(client):
    """Test smart reinforcement and importance scoring"""
    print("\n" + "="*60)
    print("TESTING SMART REINFORCEMENT")
    print("="*60)

    # Create a successful pattern
    pattern = client.store_pattern(
        pattern_name="Error Handling Middleware",
        description="Centralized error handling for Express.js applications",
        example="app.use((err, req, res, next) => { res.status(500).json({ error: err.message }) })"
    )
    pattern_id = pattern['memory_id']
    print(f"✓ Created pattern: {pattern_id}")

    # Get initial metrics
    print("\n--- Initial Metrics ---")
    metrics = client.get_memory_metrics(pattern_id)
    print(f"Salience: {metrics['salience']}")
    print(f"Coactivations: {metrics['coactivations']}")
    print(f"Importance Score: {metrics['importance_score']}")
    print(f"Tier: {metrics['tier']}")

    # Reinforce based on success
    print("\n--- Reinforcing Memory ---")
    reinforce1 = client.reinforce_memory_smart(pattern_id, reason="success")
    print(f"✓ Reinforced (success): boost = {reinforce1['boost']}")

    reinforce2 = client.reinforce_memory_smart(pattern_id, reason="frequent_use")
    print(f"✓ Reinforced (frequent_use): boost = {reinforce2['boost']}")

    reinforce3 = client.reinforce_memory_smart(pattern_id, reason="success")
    print(f"✓ Reinforced (success): boost = {reinforce3['boost']}")

    # Get updated metrics
    print("\n--- Updated Metrics ---")
    metrics2 = client.get_memory_metrics(pattern_id)
    print(f"Salience: {metrics2['salience']} (was {metrics['salience']})")
    print(f"Coactivations: {metrics2['coactivations']} (was {metrics['coactivations']})")
    print(f"Importance Score: {metrics2['importance_score']} (was {metrics['importance_score']})")
    print(f"Tier: {metrics2['tier']}")

    # Get most important memories
    print("\n--- Most Important Memories ---")
    important = client.get_most_important_memories(
        memory_type="patterns",
        limit=5
    )
    print(f"Top {len(important)} patterns by importance:")
    for i, mem in enumerate(important, 1):
        score = mem.get('importance_score', 0.0)
        content = mem.get('content', '')[:50]
        coacts = mem.get('coactivations', 0)
        print(f"{i}. Score: {score:.2f}, Coactivations: {coacts}")
        print(f"   {content}...")

def main():
    """Run all tests"""
    print("="*60)
    print("DEEP INTEGRATION FEATURE TESTS")
    print("="*60)

    # Initialize client
    client = OpenMemoryClient(
        base_url="http://localhost:8080",
        project_name="DeepIntegrationTest",
        user_id="ai-agent-system"
    )

    # Check health
    health = client.health_check()
    if not health.get("ok"):
        print("ERROR: OpenMemory server is not available")
        print("Please start OpenMemory server first:")
        print("  cd backend && npm run dev")
        sys.exit(1)

    print(f"✓ Connected to OpenMemory (v{health.get('version', 'unknown')})")
    print(f"  Tier: {health.get('tier')}")
    print(f"  Embedding: {health.get('embedding', {}).get('provider')}")

    try:
        # Run all tests
        test_emotional_memory(client)
        test_waypoint_graphs(client)
        test_pattern_detection(client)
        test_smart_reinforcement(client)

        print("\n" + "="*60)
        print("ALL TESTS COMPLETED SUCCESSFULLY!")
        print("="*60)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
