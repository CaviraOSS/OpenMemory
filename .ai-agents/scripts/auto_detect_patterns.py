#!/usr/bin/env python3
"""
Automatic Pattern Detection Script
Runs periodically to detect patterns from agent actions
Can be run as a cron job or scheduled task
"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient
import time

def run_pattern_detection(client, lookback_days=7, min_frequency=3):
    """
    Run automatic pattern detection

    Args:
        client: OpenMemoryClient instance
        lookback_days: How many days to analyze
        min_frequency: Minimum occurrences to consider a pattern
    """
    print("\n" + "="*70)
    print("AUTOMATIC PATTERN DETECTION")
    print("="*70)
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Analyzing last {lookback_days} days of actions...")
    print(f"Minimum frequency: {min_frequency} occurrences")

    try:
        # Run detection
        patterns = client.detect_patterns(
            lookback_days=lookback_days,
            min_frequency=min_frequency
        )

        if patterns:
            print(f"\n✅ Detected {len(patterns)} new patterns:")

            for i, pattern in enumerate(patterns, 1):
                name = pattern.get('pattern_name', 'Unknown')
                frequency = pattern.get('frequency', 0)
                memory_id = pattern.get('memory_id', '')

                print(f"\n{i}. {name}")
                print(f"   Frequency: {frequency} times")
                print(f"   Memory ID: {memory_id}")

                # Get pattern details
                try:
                    from openmemory_client import OpenMemoryClient
                    # Query to get full pattern details
                    results = client.query_memories(
                        query=name,
                        memory_type='patterns',
                        k=1
                    )
                    if results:
                        content = results[0].get('content', '')
                        # Extract description
                        if 'Common sequence observed:' in content:
                            desc_start = content.index('Common sequence observed:')
                            desc_end = content.index('Observed') if 'Observed' in content[desc_start:] else len(content)
                            description = content[desc_start:desc_end].strip()
                            print(f"\n   {description}")
                except Exception as e:
                    pass

            print(f"\n💡 These patterns are now stored in procedural memory and can be:")
            print(f"   • Queried with: client.query_memories('pattern name', memory_type='patterns')")
            print(f"   • Retrieved with: client.get_patterns()")
            print(f"   • Automatically suggested when similar contexts arise")

        else:
            print(f"\nℹ️  No new patterns detected")
            print(f"   This could mean:")
            print(f"   • Not enough repeated action sequences")
            print(f"   • Similar patterns already detected previously")
            print(f"   • Try lowering min_frequency or increasing lookback_days")

        # Show pattern statistics
        print(f"\n📊 Pattern Statistics:")
        all_patterns = client.get_patterns()
        auto_detected = [p for p in all_patterns if p.get('metadata', {}).get('auto_detected')]

        print(f"   Total patterns: {len(all_patterns)}")
        print(f"   Auto-detected: {len(auto_detected)}")
        print(f"   Manually recorded: {len(all_patterns) - len(auto_detected)}")

        # Get most important patterns
        important = client.get_most_important_memories(
            memory_type='patterns',
            limit=5
        )

        if important:
            print(f"\n🏆 Top Patterns (by importance):")
            for i, pattern in enumerate(important, 1):
                content = pattern.get('content', '')[:60]
                score = pattern.get('importance_score', 0.0)
                coactivations = pattern.get('coactivations', 0)

                print(f"\n   {i}. Score: {score:.2f}, Uses: {coactivations}")
                print(f"      {content}...")

    except Exception as e:
        print(f"\n❌ Error detecting patterns: {e}")
        import traceback
        traceback.print_exc()
        raise

def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Auto-detect patterns from agent actions')
    parser.add_argument('--project', default='OpenMemory', help='Project name')
    parser.add_argument('--lookback-days', type=int, default=7, help='Days to analyze')
    parser.add_argument('--min-frequency', type=int, default=3, help='Minimum pattern frequency')
    parser.add_argument('--schedule', action='store_true', help='Run as scheduled task (every 24h)')
    parser.add_argument('--base-url', default='http://localhost:8080', help='OpenMemory base URL')

    args = parser.parse_args()

    # Initialize client
    client = OpenMemoryClient(
        base_url=args.base_url,
        project_name=args.project,
        user_id="ai-agent-system"
    )

    # Check health
    health = client.health_check()
    if not health.get("ok"):
        print("❌ ERROR: OpenMemory server is not available")
        print("Please start OpenMemory server first:")
        print("  cd backend && npm run dev")
        sys.exit(1)

    print(f"✓ Connected to OpenMemory (v{health.get('version', 'unknown')})")

    # Run detection
    try:
        if args.schedule:
            print("\n🔄 Running in scheduled mode (every 24 hours)")
            print("   Press Ctrl+C to stop\n")

            while True:
                run_pattern_detection(
                    client,
                    lookback_days=args.lookback_days,
                    min_frequency=args.min_frequency
                )

                print(f"\n⏳ Next run in 24 hours...")
                try:
                    time.sleep(86400)  # 24 hours
                except KeyboardInterrupt:
                    print(f"\n\n✓ Scheduled detection stopped")
                    break
        else:
            # Single run
            run_pattern_detection(
                client,
                lookback_days=args.lookback_days,
                min_frequency=args.min_frequency
            )

    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
