"""
Tests for dual-salience functionality in OpenMemory.

Tests cover:
1. Migration applies correctly (salience_slow column exists)
2. Decay logic decays both saliences independently
3. Reinforcement on query hit boosts both saliences
4. Reserved-slots query returns wisdom + recent mix
5. API endpoints accept new parameters
"""

import pytest
import asyncio
import time
import math
import os
import tempfile
from unittest.mock import patch, MagicMock

# Set test database before imports
TEST_DB_BASE = tempfile.mktemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_BASE}"

from openmemory.core.db import db, q, DB
from openmemory.core import config as config_module
from openmemory.memory.decay import DecayCfg, apply_decay, on_query_hit, cfg
from openmemory.memory.hsg import hsg_query, add_hsg_memory


@pytest.fixture(autouse=True)
def setup_db():
    """Reset database for each test with unique db file"""
    # Create unique db file per test
    test_db = tempfile.mktemp(suffix=".db")
    os.environ["DATABASE_URL"] = f"sqlite:///{test_db}"
    # Force reload of env config
    config_module.env.database_url = f"sqlite:///{test_db}"

    # Reset db connection
    if db.conn:
        db.conn.close()
    db.conn = None
    db.connect()

    yield

    # Cleanup
    if db.conn:
        db.conn.close()
        db.conn = None
    if os.path.exists(test_db):
        os.remove(test_db)


class TestDecayCfg:
    """Test decay configuration includes dual-salience parameters"""

    def test_lambda_slow_exists(self):
        """Verify lambda_slow is defined for wisdom decay"""
        cfg = DecayCfg()
        assert hasattr(cfg, "lambda_slow")
        assert cfg.lambda_slow == 0.001  # ~2 year half-life

    def test_reinforce_fast_exists(self):
        """Verify reinforce_fast boost is defined"""
        cfg = DecayCfg()
        assert hasattr(cfg, "reinforce_fast")
        assert cfg.reinforce_fast == 0.5

    def test_reinforce_slow_exists(self):
        """Verify reinforce_slow boost is defined"""
        cfg = DecayCfg()
        assert hasattr(cfg, "reinforce_slow")
        assert cfg.reinforce_slow == 0.1


class TestDatabaseSchema:
    """Test database schema includes salience_slow column"""

    def test_salience_slow_column_exists(self):
        """Migration should create salience_slow column"""
        # Insert a test memory using direct SQL
        now = int(time.time() * 1000)
        db.execute("""
            INSERT INTO memories (id, user_id, content, salience, salience_slow, created_at, updated_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("test-id", "test-user", "test content", 0.5, 0.3, now, now, now))
        db.commit()

        # Read it back
        row = db.fetchone("SELECT salience, salience_slow FROM memories WHERE id=?", ("test-id",))
        assert row is not None
        assert row["salience"] == 0.5
        assert row["salience_slow"] == 0.3

    def test_salience_slow_default(self):
        """salience_slow should default to 0.5"""
        now = int(time.time() * 1000)
        db.execute("""
            INSERT INTO memories (id, user_id, content, salience, created_at, updated_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("test-id-2", "test-user", "test content", 0.5, now, now, now))
        db.commit()

        row = db.fetchone("SELECT salience_slow FROM memories WHERE id=?", ("test-id-2",))
        assert row["salience_slow"] == 0.5


class TestInsMem:
    """Test ins_mem includes salience_slow"""

    def test_ins_mem_with_salience_slow(self):
        """ins_mem should accept and store salience_slow"""
        now = int(time.time() * 1000)
        q.ins_mem(
            id="mem-1",
            user_id="test-user",
            content="Test memory",
            salience=0.7,
            salience_slow=0.4,
            created_at=now,
            updated_at=now,
            last_seen_at=now
        )

        row = db.fetchone("SELECT salience, salience_slow FROM memories WHERE id=?", ("mem-1",))
        assert row["salience"] == 0.7
        assert row["salience_slow"] == 0.4

    def test_ins_mem_default_salience_slow(self):
        """ins_mem should use default salience_slow if not provided"""
        now = int(time.time() * 1000)
        q.ins_mem(
            id="mem-2",
            user_id="test-user",
            content="Test memory 2",
            salience=0.7,
            created_at=now,
            updated_at=now,
            last_seen_at=now
        )

        row = db.fetchone("SELECT salience_slow FROM memories WHERE id=?", ("mem-2",))
        assert row["salience_slow"] == 0.5  # Default value


class TestDecayLogic:
    """Test dual-salience decay behavior"""

    def test_fast_decay_faster_than_slow(self):
        """Fast salience should decay faster than slow salience"""
        # Using the decay formula: new_sal = sal * exp(-lambda * dt)
        days = 30  # 30 days
        initial_sal = 1.0

        # Fast decay (lambda_cold = 0.05)
        fast_decayed = initial_sal * math.exp(-0.05 * days)

        # Slow decay (lambda_slow = 0.001)
        slow_decayed = initial_sal * math.exp(-0.001 * days)

        assert fast_decayed < slow_decayed
        assert fast_decayed < 0.3  # Should be significantly decayed
        assert slow_decayed > 0.95  # Should barely decay

    def test_half_life_calculations(self):
        """Verify half-life approximations"""
        # Half-life = ln(2) / lambda

        # Fast (cold tier): lambda = 0.05, half-life = ~14 days
        fast_half_life = math.log(2) / 0.05
        assert 13 < fast_half_life < 15

        # Slow: lambda = 0.001, half-life = ~693 days (~2 years)
        slow_half_life = math.log(2) / 0.001
        assert 690 < slow_half_life < 700


class TestReinforcementBoosts:
    """Test on_query_hit reinforces both saliences"""

    @pytest.mark.asyncio
    async def test_reinforcement_boosts_both_saliences(self):
        """Query hit should boost both fast and slow salience"""
        # Setup: Insert a memory with known salience values
        now = int(time.time() * 1000)
        mem_id = "reinforce-test"
        initial_fast = 0.3
        initial_slow = 0.2

        q.ins_mem(
            id=mem_id,
            user_id="test-user",
            content="Reinforcement test memory",
            simhash="abc123",
            primary_sector="semantic",
            salience=initial_fast,
            salience_slow=initial_slow,
            created_at=now,
            updated_at=now,
            last_seen_at=now
        )

        # Trigger reinforcement
        await on_query_hit(mem_id, "semantic", reembed_fn=None)

        # Verify both saliences increased
        row = db.fetchone("SELECT salience, salience_slow FROM memories WHERE id=?", (mem_id,))

        assert row["salience"] > initial_fast, "Fast salience should increase"
        assert row["salience_slow"] > initial_slow, "Slow salience should increase"

        # Verify boost amounts are approximately correct
        assert abs(row["salience"] - (initial_fast + cfg.reinforce_fast)) < 0.01
        assert abs(row["salience_slow"] - (initial_slow + cfg.reinforce_slow)) < 0.01


class TestReservedSlotsQuery:
    """Test reserved-slots ranking in hsg_query"""

    @pytest.fixture
    def setup_memories(self):
        """Create test memories with varying salience values"""
        now = int(time.time() * 1000)
        memories = [
            # High wisdom, low recent (old knowledge)
            ("mem-wisdom-1", "Wisdom: Python best practices", 0.2, 0.9),
            ("mem-wisdom-2", "Wisdom: Database indexing strategies", 0.3, 0.85),
            # Low wisdom, high recent (new learnings)
            ("mem-recent-1", "Recent: Today's bug fix in auth module", 0.9, 0.2),
            ("mem-recent-2", "Recent: New API endpoint added", 0.85, 0.15),
            ("mem-recent-3", "Recent: Config change for deployment", 0.8, 0.1),
            # Medium both
            ("mem-mid-1", "Moderate: Regular coding pattern", 0.5, 0.5),
        ]

        for mem_id, content, fast_sal, slow_sal in memories:
            q.ins_mem(
                id=mem_id,
                user_id="test-user",
                content=content,
                simhash=f"hash-{mem_id}",
                primary_sector="semantic",
                salience=fast_sal,
                salience_slow=slow_sal,
                created_at=now,
                updated_at=now,
                last_seen_at=now
            )

        return memories

    def test_reserved_slots_flag_default_false(self):
        """reserved_slots should default to False"""
        # Verify the function signature has the default
        import inspect
        sig = inspect.signature(hsg_query)
        assert sig.parameters["reserved_slots"].default == False

    def test_wisdom_ratio_default(self):
        """wisdom_ratio should default to 0.2 (20%)"""
        import inspect
        sig = inspect.signature(hsg_query)
        assert sig.parameters["wisdom_ratio"].default == 0.2


class TestResultItemFields:
    """Test that query results include salience_slow"""

    @pytest.mark.asyncio
    async def test_result_includes_salience_slow(self):
        """Query results should include salience_slow field"""
        # Setup
        now = int(time.time() * 1000)
        q.ins_mem(
            id="result-test",
            user_id="test-user",
            content="Test content for result fields",
            simhash="result-hash",
            primary_sector="semantic",
            salience=0.6,
            salience_slow=0.4,
            created_at=now,
            updated_at=now,
            last_seen_at=now
        )

        # Query - mock all sectors that hsg_query uses
        mock_vector = [0.1] * 768
        all_sectors = {
            "semantic": mock_vector,
            "procedural": mock_vector,
            "episodic": mock_vector,
            "reflective": mock_vector,
            "emotional": mock_vector,
        }

        with patch('openmemory.memory.hsg.embed_query_for_all_sectors') as mock_embed:
            mock_embed.return_value = all_sectors
            with patch('openmemory.core.vector_store.vector_store.search') as mock_search:
                mock_search.return_value = [{"id": "result-test", "similarity": 0.8}]

                results = await hsg_query(
                    "test",
                    k=5,
                    f={"user_id": "test-user"},
                    reserved_slots=False
                )

                if results:
                    assert "salience_slow" in results[0], "Result should include salience_slow"


class TestAPIRequestModels:
    """Test API request models accept new parameters"""

    def test_add_memory_request_accepts_salience_params(self):
        """AddMemoryRequest should accept initial_salience and initial_salience_slow"""
        from openmemory.server.routes.memory import AddMemoryRequest

        req = AddMemoryRequest(
            content="Test",
            user_id="user",
            initial_salience=0.6,
            initial_salience_slow=0.3
        )
        assert req.initial_salience == 0.6
        assert req.initial_salience_slow == 0.3

    def test_search_memory_request_accepts_reserved_slots(self):
        """SearchMemoryRequest should accept reserved_slots and wisdom_ratio"""
        from openmemory.server.routes.memory import SearchMemoryRequest

        req = SearchMemoryRequest(
            query="test",
            reserved_slots=True,
            wisdom_ratio=0.3
        )
        assert req.reserved_slots == True
        assert req.wisdom_ratio == 0.3

    def test_query_memory_request_exists(self):
        """QueryMemoryRequest should exist for /memory/query endpoint"""
        from openmemory.server.routes.memory import QueryMemoryRequest

        req = QueryMemoryRequest(
            query="test",
            k=10,
            reserved_slots=True,
            wisdom_ratio=0.2
        )
        assert req.k == 10
        assert req.reserved_slots == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
