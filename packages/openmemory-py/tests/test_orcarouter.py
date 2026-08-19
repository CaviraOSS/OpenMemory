"""Tests for OrcaRouter AI adapter (chat + embeddings)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from openmemory.ai.orcarouter import OrcaRouterAdapter


# ---------------------------------------------------------------------------
# Unit tests – mock all external calls
# ---------------------------------------------------------------------------


class TestOrcaRouterAdapterInit:
    """Test adapter initialization."""

    def test_default_init(self):
        with patch("openmemory.ai.orcarouter.env") as mock_env:
            mock_env.orcarouter_key = "sk-orca-test-key"
            mock_env.orcarouter_base_url = "https://api.orcarouter.ai/v1"
            adapter = OrcaRouterAdapter()
            assert adapter.api_key == "sk-orca-test-key"
            assert adapter.base_url == "https://api.orcarouter.ai/v1"

    def test_custom_init(self):
        adapter = OrcaRouterAdapter(api_key="custom-key", base_url="https://custom.api/v1")
        assert adapter.api_key == "custom-key"
        assert adapter.base_url == "https://custom.api/v1"

    def test_api_key_override(self):
        with patch("openmemory.ai.orcarouter.env") as mock_env:
            mock_env.orcarouter_key = "env-key"
            mock_env.orcarouter_base_url = "https://api.orcarouter.ai/v1"
            adapter = OrcaRouterAdapter(api_key="override-key")
            assert adapter.api_key == "override-key"


class TestOrcaRouterChat:
    """Test chat completion."""

    @pytest.mark.asyncio
    async def test_chat_basic(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "Hello from OrcaRouter!"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await adapter.chat([{"role": "user", "content": "Hi"}])
        assert result == "Hello from OrcaRouter!"
        adapter.client.chat.completions.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_chat_default_model(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "response"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("openmemory.ai.orcarouter.env") as mock_env:
            mock_env.orcarouter_model = None
            await adapter.chat([{"role": "user", "content": "test"}])

        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "orcarouter/auto"

    @pytest.mark.asyncio
    async def test_chat_custom_model(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "response"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        await adapter.chat(
            [{"role": "user", "content": "test"}],
            model="orcarouter/some-model",
        )
        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "orcarouter/some-model"

    @pytest.mark.asyncio
    async def test_chat_none_content_returns_empty(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = None
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await adapter.chat([{"role": "user", "content": "test"}])
        assert result == ""


class TestOrcaRouterEmbed:
    """Test embedding methods."""

    @pytest.mark.asyncio
    async def test_embed_single(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.embedding = [0.1, 0.2, 0.3] * 512  # 1536 dims
        mock_response = MagicMock()
        mock_response.data = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.embeddings.create = AsyncMock(return_value=mock_response)

        result = await adapter.embed("hello world")
        assert len(result) == 1536

    @pytest.mark.asyncio
    async def test_embed_batch(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice_1 = MagicMock()
        mock_choice_1.embedding = [0.1] * 1536
        mock_choice_2 = MagicMock()
        mock_choice_2.embedding = [0.2] * 1536
        mock_response = MagicMock()
        mock_response.data = [mock_choice_1, mock_choice_2]

        adapter.client = AsyncMock()
        adapter.client.embeddings.create = AsyncMock(return_value=mock_response)

        result = await adapter.embed_batch(["text1", "text2"])
        assert len(result) == 2
        assert all(len(v) == 1536 for v in result)

    @pytest.mark.asyncio
    async def test_embed_default_model(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.embedding = [0.1] * 1536
        mock_response = MagicMock()
        mock_response.data = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.embeddings.create = AsyncMock(return_value=mock_response)

        with patch("openmemory.ai.orcarouter.env") as mock_env:
            mock_env.orcarouter_embedding_model = None
            await adapter.embed("test")

        call_kwargs = adapter.client.embeddings.create.call_args
        assert call_kwargs.kwargs["model"] == "orcarouter/auto"

    @pytest.mark.asyncio
    async def test_embed_custom_model(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://api.orcarouter.ai/v1")

        mock_choice = MagicMock()
        mock_choice.embedding = [0.1] * 1536
        mock_response = MagicMock()
        mock_response.data = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.embeddings.create = AsyncMock(return_value=mock_response)

        await adapter.embed("test", model="custom-embed-model")
        call_kwargs = adapter.client.embeddings.create.call_args
        assert call_kwargs.kwargs["model"] == "custom-embed-model"


class TestOrcaRouterAIAdapterInterface:
    """Verify OrcaRouterAdapter satisfies AIAdapter interface."""

    def test_is_subclass_of_adapter(self):
        from openmemory.ai.adapter import AIAdapter
        assert issubclass(OrcaRouterAdapter, AIAdapter)

    def test_has_required_methods(self):
        adapter = OrcaRouterAdapter(api_key="test", base_url="https://test.com/v1")
        assert hasattr(adapter, "chat")
        assert hasattr(adapter, "embed")
        assert hasattr(adapter, "embed_batch")
        assert callable(adapter.chat)
        assert callable(adapter.embed)
        assert callable(adapter.embed_batch)


class TestOrcaRouterConfig:
    """Test OrcaRouter config integration."""

    def test_config_has_orcarouter_fields(self):
        from openmemory.core.config import EnvConfig
        with patch.dict("os.environ", {}, clear=False):
            cfg = EnvConfig()
            assert hasattr(cfg, "orcarouter_key")
            assert hasattr(cfg, "orcarouter_base_url")
            assert hasattr(cfg, "orcarouter_model")
            assert hasattr(cfg, "orcarouter_embedding_model")

    def test_config_default_base_url(self):
        from openmemory.core.config import EnvConfig
        with patch.dict("os.environ", {}, clear=False):
            cfg = EnvConfig()
            assert cfg.orcarouter_base_url == "https://api.orcarouter.ai/v1"


class TestOrcaRouterExport:
    """Test OrcaRouterAdapter is properly exported."""

    def test_exported_from_ai_package(self):
        from openmemory.ai import OrcaRouterAdapter as Imported
        assert Imported is OrcaRouterAdapter

    def test_in_all_list(self):
        from openmemory import ai
        assert "OrcaRouterAdapter" in ai.__all__


class TestEmbedDispatch:
    """Test embed dispatch includes orcarouter."""

    @pytest.mark.asyncio
    async def test_orcarouter_dispatch(self):
        with patch("openmemory.memory.embed.OrcaRouterAdapter") as MockAdapter:
            mock_instance = AsyncMock()
            mock_instance.embed = AsyncMock(return_value=[0.1] * 1536)
            MockAdapter.return_value = mock_instance

            with patch("openmemory.memory.embed.env") as mock_env:
                mock_env.orcarouter_embedding_model = "orcarouter/auto"

                from openmemory.memory.embed import emb_dispatch
                result = await emb_dispatch("orcarouter", "test text", "semantic")
                assert len(result) == 1536
                mock_instance.embed.assert_called_once()


# ---------------------------------------------------------------------------
# Integration tests – require ORCAROUTER_API_KEY
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestOrcaRouterIntegration:
    """Integration tests for OrcaRouter (requires ORCAROUTER_API_KEY)."""

    @pytest.mark.asyncio
    async def test_chat_real_api(self):
        import os
        api_key = os.getenv("ORCAROUTER_API_KEY")
        if not api_key:
            pytest.skip("ORCAROUTER_API_KEY not set")

        adapter = OrcaRouterAdapter(api_key=api_key)
        result = await adapter.chat(
            [{"role": "user", "content": "Say 'hello' and nothing else."}],
            model="orcarouter/auto",
            max_tokens=256,
        )
        assert isinstance(result, str)
        assert len(result) > 0
