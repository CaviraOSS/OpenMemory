"""
github connector for openmemory
requires: PyGithub or httpx
env vars: GITHUB_TOKEN
"""
from typing import List, Dict, Optional
import os
from .base import base_connector

class github_connector(base_connector):
    """connector for github repositories"""

    name = "github"

    def __init__(self, user_id: str = None):
        super().__init__(user_id)
        self.github = None
        self.token = None

    async def connect(self, **creds) -> bool:
        """
        authenticate with github api

        env vars:
            GITHUB_TOKEN: personal access token

        or pass:
            token: github pat
        """
        try:
            from github import Github
        except ImportError:
            raise ImportError("pip install PyGithub")

        self.token = creds.get("token") or os.environ.get("GITHUB_TOKEN")

        if not self.token:
            raise ValueError("no github token provided")

        self.github = Github(self.token)
        self._connected = True
        return True

    async def list_items(self, repo: str = None, path: str = "/", include_issues: bool = False, **filters) -> List[Dict]:
        """
        list files and optionally issues from a repo

        args:
            repo: repository in "owner/repo" format
            path: path within repo to list
            include_issues: whether to include issues
        """
        if not self._connected:
            await self.connect()

        if not repo:
            raise ValueError("repo is required (format: owner/repo)")

        repository = self.github.get_repo(repo)
        results = []
        try:
            contents = repository.get_contents(path.lstrip("/") if path != "/" else "")

            if not isinstance(contents, list):
                contents = [contents]

            for content in contents:
                results.append({
                    "id": f"{repo}:{content.path}",
                    "name": content.name,
                    "type": "dir" if content.type == "dir" else content.encoding or "file",
                    "path": content.path,
                    "size": content.size,
                    "sha": content.sha
                })
        except Exception as e:
            print(f"[github] failed to list {path}: {e}")
        if include_issues:
            issues = repository.get_issues(state="all")
            for issue in issues[:50]:
                results.append({
                    "id": f"{repo}:issue:{issue.number}",
                    "name": issue.title,
                    "type": "issue",
                    "number": issue.number,
                    "state": issue.state,
                    "labels": [l.name for l in issue.labels]
                })

        return results

    async def fetch_item(self, item_id: str) -> Dict:
        """
        fetch file or issue content

        item_id format: "owner/repo:path" or "owner/repo:issue:number"
        """
        if not self._connected:
            await self.connect()

        parts = item_id.split(":")
        repo = parts[0]

        repository = self.github.get_repo(repo)
        if len(parts) >= 3 and parts[1] == "issue":
            issue_num = int(parts[2])
            issue = repository.get_issue(number=issue_num)
            text_parts = [
                f"# {issue.title}",
                f"State: {issue.state}",
                f"Labels: {', '.join([l.name for l in issue.labels])}",
                "",
                issue.body or ""
            ]
            for comment in issue.get_comments():
                text_parts.append(f"\n---\n**{comment.user.login}:** {comment.body}")

            text = "\n".join(text_parts)

            return {
                "id": item_id,
                "name": issue.title,
                "type": "issue",
                "text": text,
                "data": text,
                "meta": {
                    "source": "github",
                    "repo": repo,
                    "issue_number": issue_num,
                    "state": issue.state
                }
            }
        else:
            path = ":".join(parts[1:]) if len(parts) > 1 else ""
            content = repository.get_contents(path)
            if isinstance(content, list):
                text = "\n".join([f"- {c.path}" for c in content])
                return {
                    "id": item_id,
                    "name": path or repo,
                    "type": "directory",
                    "text": text,
                    "data": text,
                    "meta": {"source": "github", "repo": repo, "path": path}
                }
            try:
                text = content.decoded_content.decode("utf-8")
            except:
                text = ""

            return {
                "id": item_id,
                "name": content.name,
                "type": content.encoding or "file",
                "text": text,
                "data": content.decoded_content,
                "meta": {
                    "source": "github",
                    "repo": repo,
                    "path": content.path,
                    "sha": content.sha,
                    "size": content.size
                }
            }
