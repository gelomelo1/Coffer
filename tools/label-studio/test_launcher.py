"""LabelStudio.exe launcher: port choice and the page it opens.

Run:  python -m unittest discover -s tools/label-studio
"""
import os
import socket
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import launcher  # noqa: E402


class LauncherTests(unittest.TestCase):
    def test_given_port_is_kept(self):
        self.assertEqual(launcher.choose_port(["--port", "8090"]), (8090, ["--port", "8090"]))
        self.assertEqual(launcher.choose_port(["-p", "8091", "--no-browser"]), (8091, ["-p", "8091", "--no-browser"]))

    def test_free_port_is_chosen_and_passed_on(self):
        busy = socket.socket()
        busy.bind(("127.0.0.1", 0))
        busy.listen()
        start = busy.getsockname()[1]
        try:
            port, args = launcher.choose_port([], start=start)
            self.assertNotEqual(port, start)
            self.assertEqual(args, ["--port", str(port)])
        finally:
            busy.close()

    def test_label_studio_never_opens_the_root_itself(self):
        cmd = launcher.command("C:/LS", ["--port", "8080"])
        self.assertIn("--no-browser", cmd)

    def test_the_sign_in_page_is_opened(self):
        self.assertEqual(launcher.login_url(8085), "http://localhost:8085/user/login/")
        self.assertTrue(launcher.wants_browser([]))
        self.assertFalse(launcher.wants_browser(["--no-browser"]))


if __name__ == "__main__":
    unittest.main()
