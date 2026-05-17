from __future__ import annotations

import unittest
from pathlib import Path
import sys
import tempfile
import warnings
import logging
from unittest.mock import patch

warnings.filterwarnings(
    "ignore",
    message=r".*PydanticDeprecatedSince20.*",
)
try:
    from pydantic.warnings import PydanticDeprecatedSince20
except Exception:  # pragma: no cover - compatibility fallback
    PydanticDeprecatedSince20 = None
else:
    warnings.filterwarnings("ignore", category=PydanticDeprecatedSince20)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server


class FakeResult:
    def __init__(self, result_set):
        self.result_set = result_set


class FakeGraphStore:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.calls = []

    async def query_raw(self, query, params=None):
        self.calls.append((query, params))
        if "MATCH (d:Document)-[:PART_OF]->(c:Chunk)" in query and "RETURN d.id AS document_id, c.text AS chunk_text" in query:
            return FakeResult(self.rows)
        if "MATCH (d:Document {id: $document_id})" in query and "SET d.openmemory_document_id" in query:
            return FakeResult([])
        if "MATCH (d:Document {id: id})" in query and "RETURN d.id AS id" in query:
            ids = params["ids"]
            return FakeResult([[doc_id, "codex", "D:/BooksDocs/Project Astra"] for doc_id in ids])
        raise AssertionError(f"Unexpected query: {query}")


class FakeRag:
    def __init__(self, graph_store):
        self._graph_store = graph_store


class FakeHeaders:
    def __init__(self, warnings_list):
        self._warnings_list = warnings_list

    def get_list(self, key):
        if key == "X-HF-Warning":
            return list(self._warnings_list)
        return []


class FakeResponse:
    def __init__(self, warnings_list):
        self.headers = FakeHeaders(warnings_list)


class ServerLogicTests(unittest.IsolatedAsyncioTestCase):
    def test_parse_scope_from_chunk_text(self):
        chunk = (
            "OpenMemory document id: abc\n"
            "OpenMemory user id: codex\n"
            "OpenMemory project id: D:/BooksDocs/Project Astra\n"
            "OpenMemory source: openmemory:/memory/add\n\n"
            "payload"
        )
        parsed = server._parse_scope_from_chunk_text(chunk)
        self.assertEqual(parsed["user_id"], "codex")
        self.assertEqual(parsed["project_id"], "D:/BooksDocs/Project Astra")
        self.assertEqual(parsed["source"], "openmemory:/memory/add")

    async def test_backfill_scope_metadata_dry_run(self):
        rows = [
            [
                "doc-1",
                "OpenMemory document id: doc-1\n"
                "OpenMemory user id: codex\n"
                "OpenMemory project id: D:/BooksDocs/Project Astra\n"
                "OpenMemory source: openmemory:/memory/add\n\nbody",
            ],
            [
                "doc-2",
                "OpenMemory document id: doc-2\n"
                "OpenMemory user id: codex\n"
                "OpenMemory project id: D:/BooksDocs/Project Astra\n"
                "OpenMemory source: openmemory:/api/ide/events\n\nbody",
            ],
        ]
        graph_store = FakeGraphStore(rows=rows)
        rag = FakeRag(graph_store)
        result = await server._backfill_scope_metadata(rag, dry_run=True, limit=1000)
        self.assertTrue(result["ok"])
        self.assertEqual(result["scanned_documents"], 2)
        self.assertEqual(result["backfilled_documents"], 2)
        self.assertEqual(result["skipped_documents"], 0)
        self.assertEqual(result["document_ids"], ["doc-1", "doc-2"])
        set_calls = [query for query, _ in graph_store.calls if "SET d.openmemory_document_id" in query]
        self.assertEqual(set_calls, [])

    async def test_backfill_scope_metadata_apply(self):
        rows = [
            [
                "doc-1",
                "OpenMemory document id: doc-1\n"
                "OpenMemory user id: codex\n"
                "OpenMemory project id: D:/BooksDocs/Project Astra\n"
                "OpenMemory source: openmemory:/memory/add\n\nbody",
            ]
        ]
        graph_store = FakeGraphStore(rows=rows)
        rag = FakeRag(graph_store)
        result = await server._backfill_scope_metadata(rag, dry_run=False, limit=1000)
        self.assertTrue(result["ok"])
        self.assertEqual(result["backfilled_documents"], 1)
        set_calls = [query for query, _ in graph_store.calls if "SET d.openmemory_document_id" in query]
        self.assertEqual(len(set_calls), 1)

    def test_merge_scoped_retriever_results_prefers_graph_native_mode(self):
        item_type = server._load_graphrag()[-1]
        result_type = server._load_graphrag()[-2]
        primary = result_type(
            items=[
                item_type(
                    content="## Source Document Passages\n[Source: a]\nalpha",
                    metadata={"section": "passages", "scope_filter_mode": "graph_native_chunk_pushdown"},
                )
            ],
            metadata={"scope_candidate_chunk_count": 1},
        )
        secondary = result_type(
            items=[
                item_type(
                    content="## Source Document Passages\n[Source: a]\nalpha\n---\n[Source: b]\nbeta",
                    metadata={"section": "passages", "scope_filter_mode": "graph_metadata_with_legacy_fallback"},
                )
            ],
            metadata={"scope_blocks_graph_matched": 0, "scope_blocks_legacy_matched": 1},
        )
        merged = server._merge_scoped_retriever_results(
            primary,
            secondary,
            RetrieverResult=result_type,
            RetrieverResultItem=item_type,
        )
        self.assertEqual(merged.metadata["scope_retrieval_mode"], "graph_native_pushdown_with_legacy_backfill")
        self.assertEqual(merged.metadata["scope_candidate_chunk_count"], 1)
        self.assertEqual(merged.metadata["scope_blocks_graph_matched"], 1)
        self.assertEqual(merged.metadata["scope_blocks_legacy_matched"], 1)

    def test_finalize_graph_native_retriever_result_sets_graph_native_metadata(self):
        item_type = server._load_graphrag()[-1]
        result_type = server._load_graphrag()[-2]
        primary = result_type(
            items=[
                item_type(
                    content="## Source Document Passages\n[Source: a]\nalpha\n---\n[Source: b]\nbeta",
                    metadata={"section": "passages", "scope_filter_mode": "graph_native_chunk_pushdown"},
                )
            ],
            metadata={"scope_candidate_chunk_count": 2},
        )
        finalized = server._finalize_graph_native_retriever_result(
            primary,
            RetrieverResult=result_type,
            RetrieverResultItem=item_type,
        )
        self.assertEqual(finalized.metadata["scope_retrieval_mode"], "graph_native_chunk_pushdown")
        self.assertEqual(finalized.metadata["scope_blocks_graph_matched"], 2)
        self.assertEqual(finalized.metadata["scope_blocks_legacy_matched"], 0)
        self.assertEqual(finalized.metadata["scope_candidate_chunk_count"], 2)

    def test_finalize_graph_native_retriever_result_handles_empty(self):
        result_type = server._load_graphrag()[-2]
        finalized = server._finalize_graph_native_retriever_result(
            None,
            RetrieverResult=result_type,
            RetrieverResultItem=server._load_graphrag()[-1],
        )
        self.assertEqual(finalized.metadata["scope_retrieval_mode"], "none")
        self.assertEqual(finalized.metadata["scope_blocks_graph_matched"], 0)
        self.assertEqual(finalized.metadata["scope_blocks_legacy_matched"], 0)

    def test_update_scope_state_and_contract(self):
        server._update_scope_state(
            {
                "documents_total": 11,
                "documents_missing_scope": 0,
                "chunks_total": 11,
                "chunks_missing_scope": 0,
            }
        )
        self.assertFalse(server._scope_legacy_backfill_required_state)

    def test_scope_health_contract_fields_for_healthy_graph(self):
        contract = server._scope_health_contract_fields(False)
        self.assertEqual(contract["scope_storage_contract"], "document_chunk_properties")
        self.assertTrue(contract["scope_operator_recovery_path_present"])
        self.assertTrue(contract["scope_storage_compatibility_path_present"])

    def test_scope_health_contract_fields_for_stale_graph(self):
        contract = server._scope_health_contract_fields(True)
        self.assertEqual(
            contract["scope_storage_contract"],
            "document_chunk_properties_with_legacy_fallback",
        )
        self.assertTrue(contract["scope_operator_recovery_path_present"])
        self.assertTrue(contract["scope_storage_compatibility_path_present"])

    def test_legacy_scope_recovery_flag_defaults_false(self):
        with patch.dict("os.environ", {}, clear=False):
            self.assertFalse(server._legacy_scope_recovery_enabled())

    def test_legacy_scope_recovery_flag_true(self):
        with patch.dict("os.environ", {"OM_GRAPHRAG_ENABLE_LEGACY_SCOPE_RECOVERY": "true"}, clear=False):
            self.assertTrue(server._legacy_scope_recovery_enabled())

    def test_gliner_online_fallback_flag_defaults_false(self):
        with patch.dict("os.environ", {}, clear=False):
            self.assertFalse(server._gliner_online_fallback_enabled())

    def test_gliner_online_fallback_flag_true(self):
        with patch.dict("os.environ", {"OM_GRAPHRAG_GLINER_ALLOW_ONLINE_FALLBACK": "true"}, clear=False):
            self.assertTrue(server._gliner_online_fallback_enabled())

    def test_test_disable_extraction_flag_defaults_false(self):
        with patch.dict("os.environ", {}, clear=False):
            self.assertFalse(server._test_disable_extraction())
            self.assertIsNone(server._test_extractor_override())

    async def test_test_extractor_override_returns_empty_graph(self):
        with patch.dict("os.environ", {"OM_GRAPHRAG_TEST_DISABLE_EXTRACTION": "true"}, clear=False):
            extractor = server._test_extractor_override()
            self.assertIsNotNone(extractor)
            graph = await extractor.extract(None, None, None)
            self.assertEqual(graph.nodes, [])
            self.assertEqual(graph.relationships, [])
            self.assertEqual(graph.mentions, [])

    def test_gliner_cache_snapshot_path_prefers_ref(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            ref = cache / "models--urchade--gliner_medium-v2.1" / "refs"
            snap = cache / "models--urchade--gliner_medium-v2.1" / "snapshots" / "abc123"
            ref.mkdir(parents=True)
            snap.mkdir(parents=True)
            (ref / "main").write_text("abc123", encoding="utf-8")
            resolved = server._gliner_cache_snapshot_path("urchade/gliner_medium-v2.1", str(cache))
            self.assertEqual(Path(resolved), snap)

    def test_hf_warning_filter_suppresses_only_target_message(self):
        import huggingface_hub.utils._http as hf_http

        messages = []
        original_warned = set(hf_http._WARNED_TOPICS)
        original_filters = list(hf_http.logger.filters)
        original_level = hf_http.logger.level
        original_propagate = hf_http.logger.propagate

        class _ListHandler(logging.Handler):
            def emit(self, record):
                messages.append(record.getMessage())

        handler = _ListHandler()
        try:
            hf_http.logger.handlers = []
            hf_http.logger.addHandler(handler)
            hf_http.logger.setLevel(logging.WARNING)
            hf_http.logger.propagate = False
            hf_http.logger.filters = []
            hf_http._WARNED_TOPICS.clear()
            server._hf_warning_filter_patch_installed = False
            server._hf_warning_logger_filter = None
            original = hf_http._warn_on_warning_headers
            server._install_hf_warning_filter_patch()
            response = FakeResponse(
                [
                    "topic-a; Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF_TOKEN",
                    "topic-b; keep this warning",
                ]
            )
            hf_http._warn_on_warning_headers(response)
            self.assertEqual(messages, ["keep this warning"])
            self.assertIs(hf_http._warn_on_warning_headers, original)
        finally:
            hf_http.logger.removeHandler(handler)
            hf_http.logger.filters = original_filters
            hf_http.logger.setLevel(original_level)
            hf_http.logger.propagate = original_propagate
            hf_http._WARNED_TOPICS.clear()
            hf_http._WARNED_TOPICS.update(original_warned)


if __name__ == "__main__":
    unittest.main()
