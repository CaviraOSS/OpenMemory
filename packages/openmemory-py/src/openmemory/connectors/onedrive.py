"""
onedrive connector for openmemory
requires: msal, httpx
env vars: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
"""
from typing import List, Dict, Optional
import os
from .base import base_connector

class onedrive_connector(base_connector):
    """connector for microsoft onedrive files"""

    name = "onedrive"

    def __init__(self, user_id: str = None):
        super().__init__(user_id)
        self.access_token = None
        self.graph_url = "https://graph.microsoft.com/v1.0"

    async def connect(self, **creds) -> bool:
        """
        authenticate with microsoft graph api

        env vars:
            AZURE_CLIENT_ID: azure app client id
            AZURE_CLIENT_SECRET: azure app client secret
            AZURE_TENANT_ID: azure tenant id

        or pass:
            client_id, client_secret, tenant_id

        or pass:
            access_token: pre-obtained oauth token
        """
        if "access_token" in creds:
            self.access_token = creds["access_token"]
            self._connected = True
            return True

        try:
            from msal import ConfidentialClientApplication
        except ImportError:
            raise ImportError("pip install msal")

        client_id = creds.get("client_id") or os.environ.get("AZURE_CLIENT_ID")
        client_secret = creds.get("client_secret") or os.environ.get("AZURE_CLIENT_SECRET")
        tenant_id = creds.get("tenant_id") or os.environ.get("AZURE_TENANT_ID")

        if not all([client_id, client_secret, tenant_id]):
            raise ValueError("azure credentials incomplete")

        authority = f"https://login.microsoftonline.com/{tenant_id}"

        app = ConfidentialClientApplication(
            client_id,
            authority=authority,
            client_credential=client_secret
        )

        result = app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )

        if "access_token" in result:
            self.access_token = result["access_token"]
            self._connected = True
            return True
        else:
            raise ValueError(f"auth failed: {result.get('error_description', 'unknown')}")

    async def list_items(self, folder_path: str = "/", user_principal: str = None, **filters) -> List[Dict]:
        """
        list files from onedrive

        args:
            folder_path: path to folder (default: root)
            user_principal: user email for delegated access (app-only uses /me)
        """
        if not self._connected:
            await self.connect()

        try:
            import httpx
        except ImportError:
            raise ImportError("pip install httpx")

        headers = {"Authorization": f"Bearer {self.access_token}"}
        if user_principal:
            base = f"{self.graph_url}/users/{user_principal}/drive"
        else:
            base = f"{self.graph_url}/me/drive"

        if folder_path == "/":
            url = f"{base}/root/children"
        else:
            url = f"{base}/root:/{folder_path.strip('/')}:/children"

        results = []

        async with httpx.AsyncClient() as client:
            while url:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.json()

                for item in data.get("value", []):
                    results.append({
                        "id": item["id"],
                        "name": item["name"],
                        "type": "folder" if "folder" in item else item.get("file", {}).get("mimeType", "file"),
                        "size": item.get("size", 0),
                        "modified": item.get("lastModifiedDateTime"),
                        "path": item.get("parentReference", {}).get("path", "")
                    })

                url = data.get("@odata.nextLink")

        return results

    async def fetch_item(self, item_id: str, user_principal: str = None) -> Dict:
        """fetch file content from onedrive"""
        if not self._connected:
            await self.connect()

        try:
            import httpx
        except ImportError:
            raise ImportError("pip install httpx")

        headers = {"Authorization": f"Bearer {self.access_token}"}

        if user_principal:
            base = f"{self.graph_url}/users/{user_principal}/drive"
        else:
            base = f"{self.graph_url}/me/drive"

        async with httpx.AsyncClient() as client:
            meta_resp = await client.get(f"{base}/items/{item_id}", headers=headers)
            meta_resp.raise_for_status()
            meta = meta_resp.json()
            content_resp = await client.get(f"{base}/items/{item_id}/content", headers=headers, follow_redirects=True)
            content_resp.raise_for_status()
            content = content_resp.content
            try:
                text = content.decode("utf-8")
            except:
                text = ""

        return {
            "id": item_id,
            "name": meta.get("name", "unknown"),
            "type": meta.get("file", {}).get("mimeType", "unknown"),
            "text": text,
            "data": content,
            "meta": {
                "source": "onedrive",
                "item_id": item_id,
                "size": meta.get("size", 0),
                "mime_type": meta.get("file", {}).get("mimeType", "")
            }
        }
