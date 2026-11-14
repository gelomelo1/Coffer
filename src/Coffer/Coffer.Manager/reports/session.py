"""Coffer.Manager sign-in: GitHub device flow through the backend, then a Manager token kept in memory only."""
import os
import tkinter as tk
import webbrowser
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from reports.api import AdminApi, ApiError, ManagerAuth

# Coffer.Manager/.env (git-ignored): COFFER_API_URL=http://localhost:5141
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE)


def configured_api_url():
    """The backend URL from COFFER_API_URL (Coffer.Manager/.env or the environment), or None when it is missing."""
    url = (os.getenv("COFFER_API_URL") or "").strip().rstrip("/")
    return url or None


class Session:
    """Shared by every Manager view. Holds the API URL and the Manager token (never written to disk)."""

    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.admin = None
        self.expires_at = None
        self.on_signed_out = None  # set by the App: called when the backend says the session is no longer valid

    @property
    def signed_in(self):
        return bool(self.token)

    def api(self):
        return AdminApi(self.base_url, self.token)

    def sign_in(self, token, admin, expires_at):
        self.token, self.admin, self.expires_at = token, admin, expires_at

    def sign_out(self):
        self.token = self.admin = self.expires_at = None
        if self.on_signed_out:
            self.on_signed_out()

    def handle(self, error):
        """Views call this on ApiError; an expired / revoked session sends the user back to the sign-in screen."""
        if isinstance(error, ApiError) and error.status in (401, 403) and self.signed_in:
            self.sign_out()
            return True
        return False


class LoginView(tk.Frame):
    """Shows the GitHub code, opens github.com/login/device, polls the backend until the admin confirmed."""

    def __init__(self, parent, session, on_signed_in, auth_factory=ManagerAuth):
        super().__init__(parent)
        self.session = session
        self.on_signed_in = on_signed_in
        self.auth_factory = auth_factory
        self.api_url = configured_api_url()
        self.status_var = tk.StringVar(value="Sign in with the GitHub account configured as a Coffer administrator.")
        self.code_var = tk.StringVar(value="")
        self.device = None
        self._job = None

        box = tk.Frame(self)
        box.place(relx=0.5, rely=0.4, anchor="center")
        tk.Label(box, text="Coffer.Manager", font=("Helvetica", 22, "bold"), fg="#2E86C1").pack(pady=(0, 10))
        tk.Label(box, text="Administrators only. Access is checked by the backend for every action.").pack()
        tk.Label(box, text=f"API: {self.api_url}" if self.api_url else "API: not configured", fg="gray").pack(pady=10)
        self.button = tk.Button(box, text="Sign in with GitHub", bg="#24292e", fg="white", font=("Helvetica", 12, "bold"),
                                command=self.start, padx=12, pady=4)
        self.button.pack(pady=5)
        tk.Label(box, textvariable=self.code_var, font=("Consolas", 28, "bold")).pack(pady=10)
        tk.Label(box, textvariable=self.status_var, fg="gray", wraplength=600, justify="center").pack()

    def start(self):
        if not self.api_url:
            self.status_var.set(f"Set COFFER_API_URL in {ENV_FILE} (e.g. COFFER_API_URL=http://localhost:5141) and restart Coffer.Manager.")
            return
        self.session.base_url = self.api_url
        try:
            self.device = self.auth_factory(self.session.base_url).start()
        except ApiError as e:
            self.status_var.set(f"Can't start the sign-in: {e}")
            return
        self.code_var.set(self.device["userCode"])
        self.status_var.set(f"Enter this code at {self.device['verificationUri']} (opened in your browser), then approve Coffer.")
        self.button.configure(state="disabled")
        try:
            webbrowser.open(self.device["verificationUri"])
        except Exception:
            pass
        self._schedule(self.device.get("interval", 5))

    def _schedule(self, seconds):
        self._job = self.after(int(seconds * 1000), self.poll)

    def poll(self):
        if not self.device:
            return
        interval = self.device.get("interval", 5)
        try:
            result = self.auth_factory(self.session.base_url).poll(self.device["deviceCode"])
        except ApiError as e:
            self.device = None
            self.code_var.set("")
            self.button.configure(state="normal")
            self.status_var.set(f"Sign-in failed: {e}")
            return

        status = result.get("status")
        if status == "authorized":
            admin = result.get("admin") or {}
            expires = result.get("expiresAt")
            self.session.sign_in(result["token"], admin, expires)
            self.device = None
            self.code_var.set("")
            self.button.configure(state="normal")
            self.status_var.set("Signed in.")
            self.on_signed_in()
            return
        if status == "slow_down":
            interval += 5
            self.device["interval"] = interval
        self._schedule(interval)

    def reset(self, message=None):
        if self._job:
            self.after_cancel(self._job)
            self._job = None
        self.device = None
        self.code_var.set("")
        self.button.configure(state="normal")
        if message:
            self.status_var.set(message)


def describe_expiry(expires_at):
    if not expires_at:
        return ""
    try:
        end = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        return end.astimezone().strftime("%H:%M")
    except ValueError:
        return expires_at
