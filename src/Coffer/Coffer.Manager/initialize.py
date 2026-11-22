import tkinter as tk
from tkinter import ttk
from similarity_check_training.view import SimilarityCheckTrainingView
from reports.session import LoginView, Session, describe_expiry
from reports.view import ReportedContentView, ReportsView, SuspensionsView
from itemtypes.view import ItemTypesView, OptionSetsView

VIEWS = [
    ("Similarity Check Training", lambda parent, session: SimilarityCheckTrainingView(parent)),
    ("Reported content", ReportedContentView),
    ("Individual reports", ReportsView),
    ("Suspended users", SuspensionsView),
    ("Item types", ItemTypesView),
    ("Option sets", OptionSetsView),
]


class App(tk.Tk):
    """Coffer.Manager is administrator-only: nothing but the GitHub sign-in is shown until an admin has signed in."""

    def __init__(self):
        super().__init__()
        self.title("Coffer.Manager")
        self.geometry("1600x800")
        self.resizable(False, False)

        self.session = Session(base_url=None)
        self.session.on_signed_out = self.show_login

        self.login = LoginView(self, self.session, on_signed_in=self.show_app)
        self.main = None
        self.show_login()

    def show_login(self):
        if self.main is not None:
            self.main.destroy()
            self.main = None
        self.login.reset("Signed out. Sign in again with your administrator GitHub account." if self.session.base_url else None)
        self.login.pack(fill="both", expand=True)

    def show_app(self):
        self.login.pack_forget()
        self.main = tk.Frame(self)
        self.main.pack(fill="both", expand=True)

        top = tk.Frame(self.main)
        top.pack(fill="x", padx=10, pady=10)
        self.view_selector = ttk.Combobox(top, values=[name for name, _ in VIEWS], state="readonly", width=30)
        self.view_selector.current(0)
        self.view_selector.pack(side="left")
        self.view_selector.bind("<<ComboboxSelected>>", self.switch_view)
        admin = self.session.admin or {}
        tk.Button(top, text="Sign out", command=self.session.sign_out).pack(side="right")
        tk.Label(top, text=f"Signed in as {admin.get('login')} (GitHub id {admin.get('githubId')}) · session until "
                           f"{describe_expiry(self.session.expires_at)}", fg="gray").pack(side="right", padx=10)

        self.container = tk.Frame(self.main)
        self.container.pack(expand=True, fill="both")
        self.container.grid_rowconfigure(0, weight=1)
        self.container.grid_columnconfigure(0, weight=1)

        self.views = {}
        for name, factory in VIEWS:
            frame = factory(self.container, self.session)
            self.views[name] = frame
            frame.grid(row=0, column=0, sticky="nsew")

        self.show_view(VIEWS[0][0])

    def show_view(self, name):
        frame = self.views[name]
        frame.tkraise()
        if hasattr(frame, "refresh"):
            frame.refresh()

    def switch_view(self, event):
        self.show_view(self.view_selector.get())
