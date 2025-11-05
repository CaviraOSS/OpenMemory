#!/usr/bin/env python3
"""
Sentiment Monitoring Script
Monitors agent emotional state and confidence levels in real-time
"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient
import time

def monitor_sentiment(client, continuous=False, interval=60):
    """
    Monitor agent sentiment and confidence

    Args:
        client: OpenMemoryClient instance
        continuous: If True, runs continuously
        interval: Seconds between checks (for continuous mode)
    """
    while True:
        print("\n" + "="*70)
        print("AGENT SENTIMENT MONITORING")
        print("="*70)
        print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")

        # Get sentiment trends
        try:
            trends = client.analyze_sentiment_trends()

            trend = trends.get('trend', 'neutral')
            avg_confidence = trends.get('average_confidence', 0.5)
            positive = trends.get('positive_count', 0)
            negative = trends.get('negative_count', 0)
            neutral = trends.get('neutral_count', 0)
            total = trends.get('sample_size', 0)

            # Display overall status
            print(f"\n📊 Overall Status:")
            print(f"   Trend: {trend.upper()}")
            print(f"   Average Confidence: {avg_confidence:.2f}")
            print(f"   Sample Size: {total} emotions")

            # Trend indicator
            if trend == 'positive':
                print(f"   Status: ✅ Agents are confident and making good progress")
            elif trend == 'negative':
                print(f"   Status: ⚠️  Agents may be struggling or stuck")
            else:
                print(f"   Status: ℹ️  Neutral progress")

            # Confidence warning
            if avg_confidence < 0.4:
                print(f"\n⚠️  LOW CONFIDENCE WARNING!")
                print(f"   Average confidence ({avg_confidence:.2f}) is below threshold (0.40)")
                print(f"   Recommendation: Review recent decisions and blockers")

            # Sentiment breakdown
            print(f"\n📈 Sentiment Breakdown:")
            if total > 0:
                print(f"   Positive:  {positive:3d} ({positive/total*100:5.1f}%)")
                print(f"   Negative:  {negative:3d} ({negative/total*100:5.1f}%)")
                print(f"   Neutral:   {neutral:3d} ({neutral/total*100:5.1f}%)")
            else:
                print(f"   No emotional data available")

            # Recent emotions
            print(f"\n🕐 Recent Emotions (Last 5):")
            recent = trends.get('recent_emotions', [])
            if recent:
                for i, emotion in enumerate(recent, 1):
                    sentiment = emotion.get('metadata', {}).get('sentiment', 'unknown')
                    confidence = emotion.get('metadata', {}).get('confidence', 0.0)
                    agent = emotion.get('metadata', {}).get('agent_name', 'unknown')
                    content = emotion.get('content', '')

                    # Extract feeling from content
                    feeling_match = content.split('feels: ')
                    feeling = feeling_match[1].split('\n')[0] if len(feeling_match) > 1 else content[:60]

                    # Emoji based on sentiment
                    emoji = {
                        'positive': '😊',
                        'confident': '💪',
                        'negative': '😟',
                        'frustrated': '😤',
                        'neutral': '😐'
                    }.get(sentiment, '🤔')

                    print(f"\n   {i}. {emoji} [{agent}] Confidence: {confidence:.2f}")
                    print(f"      \"{feeling}\"")
            else:
                print(f"   No recent emotions")

            # Actionable recommendations
            print(f"\n💡 Recommendations:")
            if avg_confidence < 0.3:
                print(f"   • Review recent blockers and consider alternative approaches")
                print(f"   • Query past similar situations: client.query_memories('similar problem')")
            elif avg_confidence > 0.8 and trend == 'positive':
                print(f"   • Agents are performing well - consider tackling more complex tasks")
                print(f"   • Record successful patterns for reuse")
            elif negative > positive and total > 5:
                print(f"   • High negativity detected - review recent decisions")
                print(f"   • Check for recurring blockers or frustrations")
            else:
                print(f"   • Continue monitoring - sentiment is stable")

        except Exception as e:
            print(f"\n❌ Error monitoring sentiment: {e}")

        # Break or wait
        if not continuous:
            break

        print(f"\n⏳ Next check in {interval} seconds... (Ctrl+C to stop)")
        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            print(f"\n\n✓ Monitoring stopped")
            break

def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Monitor agent sentiment and confidence')
    parser.add_argument('--project', default='OpenMemory', help='Project name')
    parser.add_argument('--continuous', action='store_true', help='Run continuously')
    parser.add_argument('--interval', type=int, default=60, help='Check interval (seconds)')
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

    # Run monitoring
    try:
        monitor_sentiment(client, continuous=args.continuous, interval=args.interval)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
