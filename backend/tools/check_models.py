"""Check which Vertex AI regions serve BirdBrains' models. Run it in Cloud Shell.

    python tools/check_models.py --project birdbrain-514606

Sends one tiny text request per model and region and prints OK or the error Google
returned. No student data is involved. Use it when uploads end in "The diagnostic
could not be completed": if Montréal says 404 or 429 for a model, that is the cause.
"""
from __future__ import annotations

import argparse
import os
import sys

DEFAULT_MODELS = [os.environ.get("BIRDBRAINS_STAGE1_MODEL", "gemini-2.5-flash"),
                  os.environ.get("BIRDBRAINS_STAGE2_MODEL", "gemini-2.5-pro")]
DEFAULT_REGIONS = ["northamerica-northeast1", "northamerica-northeast2", "us-central1", "global"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"), required=not os.environ.get("GOOGLE_CLOUD_PROJECT"))
    ap.add_argument("--models", nargs="*", default=DEFAULT_MODELS)
    ap.add_argument("--regions", nargs="*", default=DEFAULT_REGIONS)
    args = ap.parse_args()

    from google import genai

    failed = 0
    for region in args.regions:
        client = genai.Client(vertexai=True, project=args.project, location=region)
        for model in args.models:
            try:
                out = client.models.generate_content(model=model, contents="Reply with the single word: ok")
                print(f"OK     {region:26} {model}  ({(out.text or '').strip()[:20]!r})")
            except Exception as e:  # noqa: BLE001 - we want whatever Google said
                failed += 1
                print(f"FAILED {region:26} {model}  {type(e).__name__}: {str(e)[:160]}")
    print("\nThe app uses northamerica-northeast1 (Canada). Other regions are shown only so you can see what exists.")
    return 0 if failed < len(args.models) * len(args.regions) else 1


if __name__ == "__main__":
    sys.exit(main())
