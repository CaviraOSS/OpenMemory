"""
google slides connector for openmemory
requires: google-api-python-client, google-auth
env vars: GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON
"""
from typing import List, Dict, Optional
import os
import json
from .base import base_connector

class google_slides_connector(base_connector):
    """connector for google slides presentations"""

    name = "google_slides"

    def __init__(self, user_id: str = None):
        super().__init__(user_id)
        self.service = None
        self.creds = None

    async def connect(self, **creds) -> bool:
        """
        authenticate with google slides api

        env vars:
            GOOGLE_SERVICE_ACCOUNT_FILE: path to service account json
            GOOGLE_CREDENTIALS_JSON: raw json string of credentials
        """
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError:
            raise ImportError("pip install google-api-python-client google-auth")

        scopes = ["https://www.googleapis.com/auth/presentations.readonly"]

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

        self.service = build("slides", "v1", credentials=self.creds)
        self._connected = True
        return True

    async def list_items(self, presentation_id: str = None, **filters) -> List[Dict]:
        """
        list slides in a presentation

        args:
            presentation_id: the presentation id to list slides from
        """
        if not self._connected:
            await self.connect()

        if not presentation_id:
            raise ValueError("presentation_id is required")

        pres = self.service.presentations().get(presentationId=presentation_id).execute()

        slides = []
        for i, slide in enumerate(pres.get("slides", [])):
            slides.append({
                "id": f"{presentation_id}
                "name": f"Slide {i + 1}",
                "type": "slide",
                "index": i,
                "presentation_id": presentation_id,
                "object_id": slide["objectId"]
            })

        return slides

    async def fetch_item(self, item_id: str) -> Dict:
        """
        fetch presentation or single slide text

        item_id format: "presentation_id" or "presentation_id
        """
        if not self._connected:
            await self.connect()
        if "#" in item_id:
            presentation_id, slide_id = item_id.split("#", 1)
            single_slide = True
        else:
            presentation_id = item_id
            slide_id = None
            single_slide = False

        pres = self.service.presentations().get(presentationId=presentation_id).execute()

        def extract_text(element):
            """recursively extract text from slide elements"""
            texts = []

            if "shape" in element:
                shape = element["shape"]
                if "text" in shape:
                    for te in shape["text"].get("textElements", []):
                        if "textRun" in te:
                            texts.append(te["textRun"].get("content", ""))

            if "table" in element:
                table = element["table"]
                for row in table.get("tableRows", []):
                    for cell in row.get("tableCells", []):
                        if "text" in cell:
                            for te in cell["text"].get("textElements", []):
                                if "textRun" in te:
                                    texts.append(te["textRun"].get("content", ""))

            return "".join(texts)

        all_text = []

        for i, slide in enumerate(pres.get("slides", [])):
            if single_slide and slide["objectId"] != slide_id:
                continue

            slide_texts = [f"--- Slide {i + 1} ---"]

            for element in slide.get("pageElements", []):
                txt = extract_text(element)
                if txt.strip():
                    slide_texts.append(txt.strip())

            all_text.extend(slide_texts)

        text = "\n\n".join(all_text)

        return {
            "id": item_id,
            "name": pres.get("title", "Untitled Presentation"),
            "type": "presentation",
            "text": text,
            "data": text,
            "meta": {
                "source": "google_slides",
                "presentation_id": presentation_id,
                "slide_count": len(pres.get("slides", []))
            }
        }
