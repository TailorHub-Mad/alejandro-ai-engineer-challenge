from hashlib import sha256
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from backend.acquire import ensure_source
from backend.source import SOURCE_URL


class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "raw" / "A3.pdf"
        self.reviewed = b"reviewed PDF fixture"
        digest = patch("backend.acquire.PDF_SHA256", sha256(self.reviewed).hexdigest())
        digest.start()
        self.addCleanup(digest.stop)

    def test_missing_pdf_is_verified_installed_and_reused_offline(self):
        with patch("backend.acquire.urlopen", return_value=BytesIO(self.reviewed)) as fetch:
            self.assertEqual(ensure_source(self.path), self.path)
            ensure_source(self.path)
            fetch.assert_called_once_with(SOURCE_URL, timeout=30)
        self.assertEqual(self.path.read_bytes(), self.reviewed)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_changed_edition_and_network_failure_leave_no_partial_file(self):
        with patch("backend.acquire.urlopen", return_value=BytesIO(b"new edition")):
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                ensure_source(self.path)
        with patch("backend.acquire.urlopen", side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):
                ensure_source(self.path)
        self.assertEqual(list(self.path.parent.iterdir()), [])

    def test_existing_unreviewed_file_is_preserved(self):
        self.path.parent.mkdir()
        self.path.write_bytes(b"different edition")
        with patch("backend.acquire.urlopen") as fetch:
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                ensure_source(self.path)
            fetch.assert_not_called()
        self.assertEqual(self.path.read_bytes(), b"different edition")

    def test_a_file_installed_during_download_is_verified_and_preserved(self):
        def install_concurrently(source, destination):
            destination.write_bytes(b"other edition")
            raise FileExistsError

        with patch("backend.acquire.urlopen", return_value=BytesIO(self.reviewed)):
            with patch("backend.acquire.install_if_absent", side_effect=install_concurrently):
                with self.assertRaisesRegex(ValueError, "SHA-256"):
                    ensure_source(self.path)
        self.assertEqual(self.path.read_bytes(), b"other edition")
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])
