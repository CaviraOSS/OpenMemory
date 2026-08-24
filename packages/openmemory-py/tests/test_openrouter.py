from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from openmemory.ai.adapter import AIAdapter
from openmemory.ai.openrouter import OpenRouterAdapter


def test_openrouter_adapter_implements_interface():
    assert issubclass(OpenRouterAdapter, AIAdapter)


def test_openrouter_adapter_uses_configured_endpoint():
    with patch("openmemory.ai.openrouter.env") as mock_env:
        mock_env.openrouter_key = "sk-or-v1-test"
        mock_env.openrouter_base_url = "https://openrouter.ai/api/v1"
        adapter = OpenRouterAdapter()

    assert adapter.api_key == "sk-or-v1-test"
    assert adapter.base_url == "https://openrouter.ai/api/v1"


@pytest.mark.asyncio
async def test_openrouter_embed_uses_default_model():
    with patch("openmemory.ai.openrouter.env") as mock_env:
        mock_env.openrouter_key = "sk-or-v1-test"
        mock_env.openrouter_base_url = "https://openrouter.ai/api/v1"
        mock_env.openrouter_embedding_model = None
        adapter = OpenRouterAdapter()

    item = MagicMock()
    item.embedding = [0.1, 0.2]
    response = MagicMock()
    response.data = [item]
    adapter.client.embeddings.create = AsyncMock(return_value=response)

    result = await adapter.embed("hello")

    assert result == [0.1, 0.2]
    adapter.client.embeddings.create.assert_awaited_once_with(
        input="hello",
        model="openai/text-embedding-3-small",
    )


@pytest.mark.asyncio
async def test_openrouter_embed_batch_preserves_order():
    adapter = OpenRouterAdapter(
        api_key="sk-or-v1-test",
        base_url="https://openrouter.ai/api/v1",
    )
    first = MagicMock()
    first.embedding = [0.1]
    second = MagicMock()
    second.embedding = [0.2]
    response = MagicMock()
    response.data = [first, second]
    adapter.client.embeddings.create = AsyncMock(return_value=response)

    result = await adapter.embed_batch(
        ["first", "second"],
        model="vendor/custom-embedding",
    )

    assert result == [[0.1], [0.2]]
    adapter.client.embeddings.create.assert_awaited_once_with(
        input=["first", "second"],
        model="vendor/custom-embedding",
    )
