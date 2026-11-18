"""Publish the built site (./out) to Firebase Hosting through the Hosting REST API.

Used by Cloud Build (deploy/cloudbuild.yaml), which has no browser login and no key file:
the build's own service account token comes from the metadata server. firebase-tools is not
used because it handles that kind of login unreliably in CI.

    python3 deploy/hosting_deploy.py --project birdbrain-514606 [--dir out] [--dry-run]

Reads headers and clean-URL settings from firebase.json so the two cannot drift. A release
is a new Hosting version; roll back in the Firebase console (Hosting > Release history).
"""
from __future__ import annotations

import argparse
import fnmatch
import gzip
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://firebasehosting.googleapis.com/v1beta1"
METADATA_TOKEN = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"


def hosting_config(firebase_json: str) -> dict:
    """firebase.json's hosting block, translated to the REST API's version config."""
    with open(firebase_json) as f:
        h = json.load(f)["hosting"]
    cfg: dict = {}
    if h.get("cleanUrls"):
        cfg["cleanUrls"] = True
    if h.get("trailingSlash") is False:
        cfg["trailingSlashBehavior"] = "REMOVE"
    headers = [{"glob": r["source"], "headers": {x["key"]: x["value"] for x in r["headers"]}}
               for r in h.get("headers", [])]
    if headers:
        cfg["headers"] = headers
    return cfg


def manifest(directory: str, ignore: list[str]) -> tuple[dict[str, str], dict[str, bytes]]:
    """({'/path': sha256 of gzipped bytes}, {sha256: gzipped bytes})."""
    files: dict[str, str] = {}
    blobs: dict[str, bytes] = {}
    for root, _, names in os.walk(directory):
        for name in names:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, directory).replace(os.sep, "/")
            if any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(name, p) for p in ignore):
                continue
            with open(full, "rb") as f:
                gz = gzip.compress(f.read(), compresslevel=9, mtime=0)
            digest = hashlib.sha256(gz).hexdigest()
            files["/" + rel] = digest
            blobs[digest] = gz
    return files, blobs


class Client:
    def __init__(self, project: str, token: str | None = None):
        self.project = project
        self.token = token or self._metadata_token()

    @staticmethod
    def _metadata_token() -> str:
        req = urllib.request.Request(METADATA_TOKEN, headers={"Metadata-Flavor": "Google"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.load(r)["access_token"]

    def call(self, method: str, url: str, body=None, raw: bytes | None = None) -> dict:
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": f"Bearer {self.token}", "x-goog-user-project": self.project,
            "Content-Type": "application/octet-stream" if raw is not None else "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                text = r.read().decode()
        except urllib.error.HTTPError as e:
            raise SystemExit(f"{method} {url} failed: HTTP {e.code} {e.read().decode()[:300]}")
        return json.loads(text) if text.strip() else {}


def deploy(client: Client, site: str, directory: str, firebase_json: str, message: str) -> str:
    ignore = json.load(open(firebase_json))["hosting"].get("ignore", [])
    files, blobs = manifest(directory, ignore)
    if "/index.html" not in files:
        raise SystemExit(f"{directory}/index.html is missing: the site did not build")
    version = client.call("POST", f"{API}/sites/{site}/versions", {"config": hosting_config(firebase_json)})["name"]
    pop = client.call("POST", f"{API}/{version}:populateFiles", {"files": files})
    need = pop.get("uploadRequiredHashes", [])
    for digest in need:
        client.call("POST", f"{pop['uploadUrl']}/{digest}", raw=blobs[digest])
    client.call("PATCH", f"{API}/{version}?update_mask=status", {"status": "FINALIZED"})
    client.call("POST", f"{API}/sites/{site}/releases?versionName={version}", {"message": message})
    print(f"Released {version}: {len(files)} files, {len(need)} uploaded")
    return version


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--site", help="Hosting site id (default: the project id)")
    ap.add_argument("--dir", default="out")
    ap.add_argument("--firebase-json", default="firebase.json")
    ap.add_argument("--message", default=os.environ.get("COMMIT_SHA", "deploy")[:60])
    ap.add_argument("--dry-run", action="store_true", help="list what would be published, change nothing")
    args = ap.parse_args()
    if args.dry_run:
        files, _ = manifest(args.dir, json.load(open(args.firebase_json))["hosting"].get("ignore", []))
        print(json.dumps(hosting_config(args.firebase_json), indent=1))
        print(f"{len(files)} files, index.html present: {'/index.html' in files}")
        return 0
    deploy(Client(args.project), args.site or args.project, args.dir, args.firebase_json, args.message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
