"""Acquire the reviewed DAFF work instruction for local use."""
import os
import shutil
import tempfile
from hashlib import file_digest
from http.client import HTTPException
from pathlib import Path
from urllib.request import urlopen

from .source import PDF, PDF_SHA256, SOURCE_URL

# Windows rename and POSIX link both atomically fail if the destination exists.
install_if_absent = os.rename if os.name == "nt" else os.link


def verify(path):
    with path.open("rb") as stream:
        digest = file_digest(stream, "sha256").hexdigest()
    if digest != PDF_SHA256:
        raise ValueError("The PDF differs from the reviewed DAFF v7.0 edition (SHA-256 mismatch).")


def ensure_source(path=PDF):
    if path.exists():
        verify(path)
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=path.parent) as directory:
        download = Path(directory) / "download.pdf"
        with urlopen(SOURCE_URL, timeout=30) as response, download.open("wb") as stream:
            shutil.copyfileobj(response, stream)
        verify(download)
        try:
            install_if_absent(download, path)
        except FileExistsError:
            verify(path)
    return path


if __name__ == "__main__":
    try:
        print(f"Verified {ensure_source()}")
    except (OSError, ValueError, HTTPException) as error:
        raise SystemExit(f"Could not prepare the reviewed PDF: {error}") from None
