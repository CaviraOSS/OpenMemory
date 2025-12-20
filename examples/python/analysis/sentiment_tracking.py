
import asyncio
from openmemory.client import Memory

# ==================================================================================
# SENTIMENT TRACKING
# ==================================================================================
# analyzing user memory stream to detect mood shifts over time.
# ==================================================================================

# Mock sentiment analyzer (replace with NLTK/TextBlob)
def analyze_sentiment(text: str) -> float:
    pos = ["happy", "good", "great", "love", "exciting"]
    neg = ["sad", "bad", "terrible", "hate", "boring"]
    score = 0
    for w in pos: 
        if w in text.lower(): score += 1
    for w in neg:
        if w in text.lower(): score -= 1
    return score

async def track_mood(mem: Memory, uid: str):
    # Fetch chronological history
    history = mem.history(user_id=uid, limit=20)
    # history usually returns newest first? Let's check docs or assume.
    # We want chronological for plotting.
    chronological = reversed(history)
    
    print(f"Tracking mood for {uid}...")
    
    timeline = []
    for h in chronological:
        score = analyze_sentiment(h['content'])
        timeline.append(score)
        print(f"Msg: '{h['content'][:30]}...' -> Score: {score}")
        
    avg = sum(timeline) / len(timeline) if timeline else 0
    print(f"\nAverage Mood Score: {avg:.2f}")

async def main():
    mem = Memory()
    uid = "user_moody"
    
    # seed
    await mem.add("I feel great today!", user_id=uid)
    await mem.add("This code is terrible.", user_id=uid)
    await mem.add("I love solving bugs.", user_id=uid)
    
    await track_mood(mem, uid)

if __name__ == "__main__":
    asyncio.run(main())
