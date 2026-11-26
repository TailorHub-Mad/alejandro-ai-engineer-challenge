import unittest
from unittest.mock import patch

from backend import __main__ as launcher


class LauncherTests(unittest.TestCase):
    def test_startup_prepares_source_and_serves_on_the_selected_interface(self):
        for flags, host in [(["--container"], "0.0.0.0"), ([], "127.0.0.1")]:
            with (self.subTest(flags=flags), patch("sys.argv", ["backend", *flags]),
                  patch.object(launcher, "ensure_source") as source,
                  patch.object(launcher, "Index") as index,
                  patch.object(launcher, "Models"),
                  patch.object(launcher.uvicorn, "run") as serve):
                launcher.main()
                source.assert_called_once_with()
                index.assert_called_once_with()
                serve.assert_called_once_with("backend.app:app", host=host, port=8000)
