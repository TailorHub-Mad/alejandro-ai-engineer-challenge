"""Build the local index on first use, then serve the question form and API."""
import argparse
from http.client import HTTPException

import uvicorn

from .acquire import ensure_source
from .index import Index, StaleIndex, build
from .models import ModelError, Models


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", action="store_true", help="serve the container on port 8000")
    args = parser.parse_args()
    try:
        models = Models()
    except ModelError as error:
        raise SystemExit(f"Could not start the ask screen: {error}") from None
    try:
        ensure_source()
    except (OSError, ValueError, HTTPException) as error:
        raise SystemExit(f"Could not prepare the reviewed PDF: {error}") from None
    try:
        Index()
    except (FileNotFoundError, StaleIndex):
        print("Preparing the six inspection steps for the current embedding format...", flush=True)
        try:
            build(models)
        except (ModelError, ValueError, OSError) as error:
            raise SystemExit(f"Could not build the index: {error}") from None

    try:
        host = "0.0.0.0" if args.container else "127.0.0.1"
        uvicorn.run("backend.app:app", host=host, port=8000)
    except OSError as error:
        raise SystemExit(f"Could not start the ask screen: {error}") from None


if __name__ == "__main__":
    main()
