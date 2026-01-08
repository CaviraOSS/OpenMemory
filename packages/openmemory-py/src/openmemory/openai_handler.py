from typing import Any, List, Dict, Optional, Union
import logging
import asyncio
import json

logger = logging.getLogger("openmemory.client")

class OpenAIRegistrar:
    def __init__(self, memory_instance):
        self.mem = memory_instance

    def register(self, client: Any, user_id: str = None):
        try:
            original_create = client.chat.completions.create
        except AttributeError:
             return client

        memory = self.mem
        is_async = hasattr(client, "_is_async") and client._is_async

        if is_async:
            async def wrapped_create(*args, **kwargs):
                messages = kwargs.get("messages", [])
                uid = user_id or memory.default_user
                if messages and uid:
                    try:
                        last_msg = messages[-1]
                        if last_msg.get("role") == "user":
                            query = last_msg.get("content")
                            if isinstance(query, str):
                                context = await memory.search(query, user_id=uid, limit=3)
                                if context:
                                    ctx_text = "\n".join([f"- {m['content']}" for m in context])
                                    instr = f"\n\nrelevant context from memory:\n{ctx_text}"
                                    if messages[0].get("role") == "system":
                                        messages[0]["content"] += instr
                                    else:
                                        messages.insert(0, {"role": "system", "content": instr})
                                    kwargs["messages"] = messages
                    except Exception as e:
                        logger.warning(f"failed to retrieve memory: {e}")

                response = await original_create(*args, **kwargs)
                try:
                    query = messages[-1].get("content") if messages else ""
                    answer = response.choices[0].message.content
                    asyncio.create_task(memory.add(f"user: {query}\nassistant: {answer}", user_id=uid))
                except Exception as e:
                    logger.warning(f"failed to store interaction: {e}")
                return response
        else:
            def wrapped_create(*args, **kwargs):
                messages = kwargs.get("messages", [])
                uid = user_id or memory.default_user
                if messages and uid:
                    try:
                        last_msg = messages[-1]
                        if last_msg.get("role") == "user":
                            query = last_msg.get("content")
                            if isinstance(query, str):
                                try:
                                    loop = asyncio.get_event_loop()
                                    if loop.is_running():
                                        context = asyncio.run_coroutine_threadsafe(memory.search(query, user_id=uid, limit=3), loop).result()
                                    else:
                                        context = asyncio.run(memory.search(query, user_id=uid, limit=3))
                                    if context:
                                        ctx_text = "\n".join([f"- {m['content']}" for m in context])
                                        instr = f"\n\nrelevant context from memory:\n{ctx_text}"
                                        if messages[0].get("role") == "system":
                                            messages[0]["content"] += instr
                                        else:
                                            messages.insert(0, {"role": "system", "content": instr})
                                        kwargs["messages"] = messages
                                except Exception: pass
                    except Exception: pass

                response = original_create(*args, **kwargs)
                try:
                    query = messages[-1].get("content") if messages else ""
                    answer = response.choices[0].message.content
                    asyncio.run(memory.add(f"user: {query}\nassistant: {answer}", user_id=uid))
                except Exception: pass
                return response

        client.chat.completions.create = wrapped_create
        return client
