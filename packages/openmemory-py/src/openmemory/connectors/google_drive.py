"""
google drive connector for openmemory
requires: google-api-python-client, google-auth
env vars: GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON
"""
from typing import List, Dict, Optional
import os
import json
from .base import base_connector

class google_drive_connector(base_connector):
    """connector for google drive documents"""

    name = "google_drive"

    def __init__(self, user_id: str = None):
        super().__init__(user_id)
        self.service = None
        self.creds = None

    async def connect(self, **creds) -> bool:
        """
        authenticate with google drive api

        env vars:
            GOOGLE_SERVICE_ACCOUNT_FILE: path to service account json
            GOOGLE_CREDENTIALS_JSON: raw json string of credentials

        or pass:
            service_account_file: path to json file
            credentials_json: dict of credentials
        """
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError:
            raise ImportError("pip install google-api-python-client google-auth")

        scopes = ["https://www.googleapis.com/auth/drive.readonly"]
        if "credentials_json" in creds:
            self.creds = service_account.Credentials.from_service_account_info(
                creds["credentials_json"], scopes=scopes
            )
        elif "service_account_file" in creds:
            self.creds = service_account.Credentials.from_service_account_file(
                creds["service_account_file"], scopes=scopes
            )
        elif os.environ.get("GOOGLE_CREDENTIALS_JSON"):
            info = json.loads(os.environ["GOOGLE_CREDENTIALS_JSON"])
            self.creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
        elif os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE"):
            self.creds = service_account.Credentials.from_service_account_file(
                os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"], scopes=scopes
            )
        else:
            raise ValueError("no google credentials provided")

        self.service = build("drive", "v3", credentials=self.creds)
        self._connected = True
        return True

    async def list_items(self, folder_id: str = None, mime_types: List[str] = None, **filters) -> List[Dict]:
        """
        list files from drive

        args:
            folder_id: optional folder to list from
            mime_types: filter by mime types (e.g. ["application/pdf"])
        """
        if not self._connected:
            await self.connect()

        q_parts = ["trashed=false"]

        if folder_id:
            q_parts.append(f"'{folder_id}' in parents")

        if mime_types:
            mime_q = " or ".join([f"mimeType='{m}'" for m in mime_types])
            q_parts.append(f"({mime_q})")

        query = " and ".join(q_parts)

        results = []
        page_token = None

        while True:
            resp = self.service.files().list(
                q=query,
                spaces="drive",
                fields="nextPageToken, files(id, name, mimeType, modifiedTime)",
                pageToken=page_token,
                pageSize=100
            ).execute()

            for f in resp.get("files", []):
                results.append({
                    "id": f["id"],
                    "name": f["name"],
                    "type": f["mimeType"],
                    "modified": f.get("modifiedTime")
                })

            page_token = resp.get("nextPageToken")
            if not page_token:
                break

        return results

    async def fetch_item(self, item_id: str) -> Dict:
        """fetch and extract text from a drive file"""
        if not self._connected:
            await self.connect()
        meta = self.service.files().get(fileId=item_id, fields="id,name,mimeType").execute()
        mime = meta["mimeType"]
        if mime == "application/vnd.google-apps.document":
            content = self.service.files().export(
                fileId=item_id, mimeType="text/plain"
            ).execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else content
        elif mime == "application/vnd.google-apps.spreadsheet":
            content = self.service.files().export(
                fileId=item_id, mimeType="text/csv"
            ).execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else content
        elif mime == "application/vnd.google-apps.presentation":
            content = self.service.files().export(
                fileId=item_id, mimeType="text/plain"
            ).execute()
            text = content.decode("utf-8") if isinstance(content, bytes) else content
        else:
            from googleapiclient.http import MediaIoBaseDownload
            import io

            request = self.service.files().get_media(fileId=item_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)

            done = False
            while not done:
                _, done = downloader.next_chunk()

            text = fh.getvalue()

        return {
            "id": item_id,
            "name": meta["name"],
            "type": mime,
            "text": text if isinstance(text, str) else "",
            "data": text if isinstance(text, bytes) else text.encode("utf-8"),
            "meta": {"source": "google_drive", "file_id": item_id, "mime_type": mime}
        }
