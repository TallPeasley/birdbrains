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

# Gemini 2.5 was retired on Vertex AI on 2026-10-20, so the app's current defaults answer
# "404 not found". These are the newer models Google's locations page lists for Montréal.
DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash",
                  "gemini-3.1-pro-preview", "gemini-3-flash-preview"]
# Canada only by default: Montréal and Toronto. Add --regions to look further.
DEFAULT_REGIONS = ["northamerica-northeast1", "northamerica-northeast2"]


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
    print("\nPick models that say OK in the region you want, then set BIRDBRAINS_STAGE1_MODEL, BIRDBRAINS_STAGE2_MODEL and BIRDBRAINS_VERTEX_LOCATION.")
    return 0 if failed < len(args.models) * len(args.regions) else 1


if __name__ == "__main__":
    sys.exit(main())
