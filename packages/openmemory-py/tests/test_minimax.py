"""Tests for MiniMax AI adapter (chat + embeddings)."""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from openmemory.ai.minimax import MiniMaxAdapter


# ---------------------------------------------------------------------------
# Unit tests – mock all external calls
# ---------------------------------------------------------------------------


class TestMiniMaxAdapterInit:
    """Test adapter initialization."""

    def test_default_init(self):
        with patch("openmemory.ai.minimax.env") as mock_env:
            mock_env.minimax_key = "test-key"
            mock_env.minimax_base_url = "https://api.minimax.io/v1"
            adapter = MiniMaxAdapter()
            assert adapter.api_key == "test-key"
            assert adapter.base_url == "https://api.minimax.io/v1"

    def test_custom_init(self):
        adapter = MiniMaxAdapter(api_key="custom-key", base_url="https://custom.api/v1")
        assert adapter.api_key == "custom-key"
        assert adapter.base_url == "https://custom.api/v1"

    def test_api_key_override(self):
        with patch("openmemory.ai.minimax.env") as mock_env:
            mock_env.minimax_key = "env-key"
            mock_env.minimax_base_url = "https://api.minimax.io/v1"
            adapter = MiniMaxAdapter(api_key="override-key")
            assert adapter.api_key == "override-key"


class TestMiniMaxChat:
    """Test chat completion."""

    @pytest.mark.asyncio
    async def test_chat_basic(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "Hello from MiniMax!"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await adapter.chat([{"role": "user", "content": "Hi"}])
        assert result == "Hello from MiniMax!"
        adapter.client.chat.completions.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_chat_default_model(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "response"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("openmemory.ai.minimax.env") as mock_env:
            mock_env.minimax_model = None
            await adapter.chat([{"role": "user", "content": "test"}])

        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "MiniMax-M2.7"

    @pytest.mark.asyncio
    async def test_chat_custom_model(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "response"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        await adapter.chat(
            [{"role": "user", "content": "test"}],
            model="MiniMax-M2.5-highspeed",
        )
        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["model"] == "MiniMax-M2.5-highspeed"

    @pytest.mark.asyncio
    async def test_chat_temperature_clamping(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "response"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        # temperature > 1.0 should be clamped to 1.0
        await adapter.chat(
            [{"role": "user", "content": "test"}],
            temperature=2.0,
        )
        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["temperature"] == 1.0

        # temperature < 0.0 should be clamped to 0.0
        await adapter.chat(
            [{"role": "user", "content": "test"}],
            temperature=-0.5,
        )
        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["temperature"] == 0.0

    @pytest.mark.asyncio
    async def test_chat_none_content_returns_empty(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = None
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await adapter.chat([{"role": "user", "content": "test"}])
        assert result == ""

    @pytest.mark.asyncio
    async def test_chat_system_message(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        mock_choice = MagicMock()
        mock_choice.message.content = "ok"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        adapter.client = AsyncMock()
        adapter.client.chat.completions.create = AsyncMock(return_value=mock_response)

        messages = [
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "Hi"},
        ]
        await adapter.chat(messages)
        call_kwargs = adapter.client.chat.completions.create.call_args
        assert call_kwargs.kwargs["messages"] == messages


class TestMiniMaxEmbed:
    """Test embedding methods."""

    @pytest.mark.asyncio
    async def test_embed_single(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")
        mock_vectors = [[0.1, 0.2, 0.3] * 512]  # 1536 dims

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": mock_vectors}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            result = await adapter.embed("hello world")
            assert result == mock_vectors[0]
            assert len(result) == 1536

    @pytest.mark.asyncio
    async def test_embed_uses_query_type(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": [[0.1] * 1536]}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            await adapter.embed("search query")
            call_kwargs = mock_client_instance.post.call_args
            payload = call_kwargs.kwargs["json"]
            assert payload["type"] == "query"

    @pytest.mark.asyncio
    async def test_embed_batch(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")
        mock_vectors = [[0.1] * 1536, [0.2] * 1536, [0.3] * 1536]

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": mock_vectors}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            result = await adapter.embed_batch(["text1", "text2", "text3"])
            assert len(result) == 3
            assert all(len(v) == 1536 for v in result)

    @pytest.mark.asyncio
    async def test_embed_batch_uses_db_type(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": [[0.1] * 1536]}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            await adapter.embed_batch(["text1"])
            call_kwargs = mock_client_instance.post.call_args
            payload = call_kwargs.kwargs["json"]
            assert payload["type"] == "db"

    @pytest.mark.asyncio
    async def test_embed_default_model(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": [[0.1] * 1536]}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            with patch("openmemory.ai.minimax.env") as mock_env:
                mock_env.minimax_embedding_model = None
                await adapter.embed("test")

            call_kwargs = mock_client_instance.post.call_args
            payload = call_kwargs.kwargs["json"]
            assert payload["model"] == "embo-01"

    @pytest.mark.asyncio
    async def test_embed_custom_model(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://api.minimax.io/v1")

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": [[0.1] * 1536]}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            await adapter.embed("test", model="custom-embed-model")
            call_kwargs = mock_client_instance.post.call_args
            payload = call_kwargs.kwargs["json"]
            assert payload["model"] == "custom-embed-model"

    @pytest.mark.asyncio
    async def test_embed_auth_header(self):
        adapter = MiniMaxAdapter(api_key="my-secret-key", base_url="https://api.minimax.io/v1")

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": [[0.1] * 1536]}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            await adapter.embed("test")
            call_kwargs = mock_client_instance.post.call_args
            headers = call_kwargs.kwargs["headers"]
            assert headers["Authorization"] == "Bearer my-secret-key"

    @pytest.mark.asyncio
    async def test_embed_endpoint_url(self):
        adapter = MiniMaxAdapter(api_key="key", base_url="https://api.minimax.io/v1")

        with patch("openmemory.ai.minimax.httpx.AsyncClient") as MockClient:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {"vectors": [[0.1] * 1536]}
            mock_resp.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            await adapter.embed("test")
            call_args = mock_client_instance.post.call_args
            assert call_args.args[0] == "https://api.minimax.io/v1/embeddings"


class TestMiniMaxAIAdapterInterface:
    """Verify MiniMaxAdapter satisfies AIAdapter interface."""

    def test_is_subclass_of_adapter(self):
        from openmemory.ai.adapter import AIAdapter
        assert issubclass(MiniMaxAdapter, AIAdapter)

    def test_has_required_methods(self):
        adapter = MiniMaxAdapter(api_key="test", base_url="https://test.com/v1")
        assert hasattr(adapter, "chat")
        assert hasattr(adapter, "embed")
        assert hasattr(adapter, "embed_batch")
        assert callable(adapter.chat)
        assert callable(adapter.embed)
        assert callable(adapter.embed_batch)


class TestMiniMaxConfig:
    """Test MiniMax config integration."""

    def test_config_has_minimax_fields(self):
        from openmemory.core.config import EnvConfig
        with patch.dict("os.environ", {}, clear=False):
            cfg = EnvConfig()
            assert hasattr(cfg, "minimax_key")
            assert hasattr(cfg, "minimax_base_url")
            assert hasattr(cfg, "minimax_model")
            assert hasattr(cfg, "minimax_embedding_model")

    def test_config_default_base_url(self):
        from openmemory.core.config import EnvConfig
        with patch.dict("os.environ", {}, clear=False):
            cfg = EnvConfig()
            assert cfg.minimax_base_url == "https://api.minimax.io/v1"


class TestMiniMaxExport:
    """Test MiniMaxAdapter is properly exported."""

    def test_exported_from_ai_package(self):
        from openmemory.ai import MiniMaxAdapter as Imported
        assert Imported is MiniMaxAdapter

    def test_in_all_list(self):
        from openmemory import ai
        assert "MiniMaxAdapter" in ai.__all__


class TestEmbedDispatch:
    """Test embed dispatch includes minimax."""

    @pytest.mark.asyncio
    async def test_minimax_dispatch(self):
        with patch("openmemory.memory.embed.MiniMaxAdapter") as MockAdapter:
            mock_instance = AsyncMock()
            mock_instance.embed = AsyncMock(return_value=[0.1] * 1536)
            MockAdapter.return_value = mock_instance

            with patch("openmemory.memory.embed.env") as mock_env:
                mock_env.minimax_embedding_model = "embo-01"

                from openmemory.memory.embed import emb_dispatch
                result = await emb_dispatch("minimax", "test text", "semantic")
                assert len(result) == 1536
                mock_instance.embed.assert_called_once()


# ---------------------------------------------------------------------------
# Integration tests – require MINIMAX_API_KEY
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestMiniMaxIntegrationChat:
    """Integration tests for MiniMax chat (requires MINIMAX_API_KEY)."""

    @pytest.mark.asyncio
    async def test_chat_real_api(self):
        import os
        api_key = os.getenv("MINIMAX_API_KEY")
        if not api_key:
            pytest.skip("MINIMAX_API_KEY not set")

        adapter = MiniMaxAdapter(api_key=api_key)
        result = await adapter.chat(
            [{"role": "user", "content": "Say 'hello' and nothing else."}],
            model="MiniMax-M2.5-highspeed",
            temperature=0.0,
        )
        assert isinstance(result, str)
        assert len(result) > 0
        assert "hello" in result.lower()


@pytest.mark.integration
class TestMiniMaxIntegrationEmbed:
    """Integration tests for MiniMax embeddings (requires MINIMAX_API_KEY)."""

    @pytest.mark.asyncio
    async def test_embed_real_api(self):
        import os
        api_key = os.getenv("MINIMAX_API_KEY")
        if not api_key:
            pytest.skip("MINIMAX_API_KEY not set")

        adapter = MiniMaxAdapter(api_key=api_key)
        result = await adapter.embed("The quick brown fox jumps over the lazy dog")
        assert isinstance(result, list)
        assert len(result) == 1536
        assert all(isinstance(v, float) for v in result)

    @pytest.mark.asyncio
    async def test_embed_batch_real_api(self):
        import os
        api_key = os.getenv("MINIMAX_API_KEY")
        if not api_key:
            pytest.skip("MINIMAX_API_KEY not set")

        adapter = MiniMaxAdapter(api_key=api_key)
        result = await adapter.embed_batch(["hello world", "foo bar baz"])
        assert isinstance(result, list)
        assert len(result) == 2
        assert all(len(v) == 1536 for v in result)
