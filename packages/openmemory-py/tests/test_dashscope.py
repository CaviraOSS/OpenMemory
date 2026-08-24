from openmemory.core.config import EnvConfig


def test_dashscope_key_is_used_for_openai_compatible_provider(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OM_OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("DASHSCOPE_API_KEY", "sk-dashscope-test")
    monkeypatch.setenv(
        "OM_OPENAI_BASE_URL",
        "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    )
    monkeypatch.setenv("OM_OPENAI_MODEL", "text-embedding-v4")

    config = EnvConfig()

    assert config.openai_key == "sk-dashscope-test"
    assert config.openai_base_url.endswith("/compatible-mode/v1")
    assert config.openai_model == "text-embedding-v4"


def test_openai_key_keeps_precedence_over_dashscope(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-test")
    monkeypatch.setenv("OM_OPENAI_API_KEY", "sk-scoped-test")
    monkeypatch.setenv("DASHSCOPE_API_KEY", "sk-dashscope-test")

    assert EnvConfig().openai_key == "sk-openai-test"
