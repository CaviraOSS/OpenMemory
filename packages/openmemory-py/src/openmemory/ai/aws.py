import json
import os
from typing import List, Dict, Any, Optional
from ..core.config import env
from .adapter import AIAdapter

try:
    import boto3
    from botocore.config import Config
except ImportError:
    boto3 = None

class AwsAdapter(AIAdapter):
    def __init__(self, region: str = None, access_key: str = None, secret_key: str = None):
        if not boto3: raise ImportError("boto3 not installed")

        self.region = region or env.aws_region or os.getenv("AWS_REGION")
        self.access_key = access_key or env.aws_access_key_id or os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = secret_key or env.aws_secret_access_key or os.getenv("AWS_SECRET_ACCESS_KEY")

        if not self.region: raise ValueError("AWS Region missing")

        self.client = boto3.client(
            service_name="bedrock-runtime",
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key
        )

    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        m = model or "anthropic.claude-3-sonnet-20240229-v1:0"

        prompt = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system": prompt += f"System: {content}\n\n"
            elif role == "user": prompt += f"Human: {content}\n\n"
            elif role == "assistant": prompt += f"Assistant: {content}\n\n"

        prompt += "Assistant:"

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [
                {"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"
            ],
            "system": next((m["content"] for m in messages if m["role"] == "system"), "")
        })

        try:
            response = self.client.invoke_model(
                modelId=m,
                body=body
            )
            res_body = json.loads(response.get("body").read())
            return res_body["content"][0]["text"]
        except Exception:
            return "Error: Bedrock chat failed or model not supported in adapter."

    async def embed(self, text: str, model: str = None) -> List[float]:
        m = model or "amazon.titan-embed-text-v2:0"

        body = json.dumps({
            "inputText": text,
            "dimensions": env.vec_dim or 1024,
            "normalize": True
        })

        try:
            response = self.client.invoke_model(
                modelId=m,
                body=body,
                accept="application/json",
                contentType="application/json"
            )

            res_body = json.loads(response.get("body").read())
            return res_body.get("embedding")
        except Exception as e:
            raise Exception(f"AWS Bedrock Error: {e}")

    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        res = []
        for t in texts:
            res.append(await self.embed(t, model))
        return res
