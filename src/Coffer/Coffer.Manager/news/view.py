"""News posts of Coffer.Manager (administrators only; the backend checks every request).

A post is written as a draft: title, optional banner and markdown content (images uploaded to the news store, links to
app pages picked from a search). Publishing shows it in the app's Community › News; the first publish sets its date and
later edits while published are marked "edited". The markdown is on the left, a live preview on the right.
"""
import io
import tkinter as tk
from datetime import datetime
from tkinter import filedialog, messagebox, ttk

from news import markdown_tools as md
from news.preview import segments
from reports.view import _AdminView, _tree

GREY = "#9A9A9A"
RED = "#B3261E"
BLUE = "#2E86C1"
GOLD = "#A98D3C"
MAX_TITLE = 120
MAX_CONTENT = 50_000
IMAGE_TYPES = [("Images", "*.png *.jpg *.jpeg *.webp")]

LINK_KINDS = [("Item", "item"), ("Collection", "collection"), ("Listing", "listing"), ("User", "user"), ("News post", "news"),
              ("App page", "page")]
APP_PAGES = [("Home (feed)", "coffer://home"), ("My collections", "coffer://collections"), ("Follows", "coffer://follows"),
             ("Community", "coffer://community"), ("Community › Stats & facts", "coffer://community/stats"),
             ("Community › News", "coffer://community/news"), ("Market", "coffer://market"), ("Settings", "coffer://settings")]


def _when(iso):
    """API date (UTC ISO) → local "2026-11-23 12:03"."""
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return iso


def status_line(post, dirty):
    """The editor's status: draft / published (and edited), when it was last saved, unsaved changes."""
    if post is None:
        text = "New post · not saved yet"
    elif post["status"] == "published":
        text = f"Published {_when(post.get('publishedAt'))}"
        if post.get("editedAt"):
            text += f" · edited {_when(post['editedAt'])}"
    else:
        text = f"Draft · last saved {_when(post.get('updatedAt'))}"
    return text + (" · unsaved changes" if dirty else "")


class _Dialog(tk.Toplevel):
    def __init__(self, parent, title):
        super().__init__(parent)
        self.title(title)
        self.transient(parent.winfo_toplevel())
        self.resizable(False, False)
        self.result = None
        self.bind("<Escape>", lambda _e: self.destroy())

    def run(self):
        self.grab_set()
        self.wait_window()
        return self.result


class WebLinkDialog(_Dialog):
    """Text + URL; only http(s) and mailto links (anything else would not open in the app)."""

    def __init__(self, parent, label):
        super().__init__(parent, "Web link")
        tk.Label(self, text="Text").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        self.label_var = tk.StringVar(value=label)
        tk.Entry(self, textvariable=self.label_var, width=50).grid(row=0, column=1, padx=8, pady=4)
        tk.Label(self, text="URL").grid(row=1, column=0, sticky="w", padx=8, pady=4)
        self.url_var = tk.StringVar(value="https://")
        url = tk.Entry(self, textvariable=self.url_var, width=50)
        url.grid(row=1, column=1, padx=8, pady=4)
        self.error = tk.Label(self, text="", fg=RED)
        self.error.grid(row=2, column=0, columnspan=2, sticky="w", padx=8)
        buttons = tk.Frame(self)
        buttons.grid(row=3, column=0, columnspan=2, sticky="e", padx=8, pady=8)
        tk.Button(buttons, text="Insert", command=self._ok, bg=BLUE, fg="white").pack(side="left", padx=4)
        tk.Button(buttons, text="Cancel", command=self.destroy).pack(side="left")
        self.bind("<Return>", lambda _e: self._ok())
        url.focus_set()
        url.select_range(0, "end")

    def _ok(self):
        url = self.url_var.get().strip()
        label = self.label_var.get().strip() or url
        if not (url.lower().startswith(("https://", "http://")) and len(url) > 8) and not url.lower().startswith("mailto:"):
            self.error.configure(text="Use an https://, http:// or mailto: link.")
            return
        self.result = md.link(label, url)
        self.destroy()


class AppLinkDialog(_Dialog):
    """Picks what the link opens in the app: search users, collections, items, listings or news by name, or a page."""

    def __init__(self, parent, view, label):
        super().__init__(parent, "App link")
        self.view = view
        self.targets = []
        top = tk.Frame(self)
        top.pack(fill="x", padx=8, pady=(8, 4))
        tk.Label(top, text="Opens").pack(side="left")
        self.kind = ttk.Combobox(top, values=[k for k, _ in LINK_KINDS], state="readonly", width=14)
        self.kind.current(0)
        self.kind.pack(side="left", padx=6)
        self.kind.bind("<<ComboboxSelected>>", lambda _e: self._kind_changed())
        self.query_var = tk.StringVar()
        self.query = tk.Entry(top, textvariable=self.query_var, width=32)
        self.query.pack(side="left", padx=6)
        self.query.bind("<Return>", lambda _e: self._search())
        self.search_button = tk.Button(top, text="Search", command=self._search)
        self.search_button.pack(side="left")

        self.results = tk.Listbox(self, width=80, height=12, exportselection=False)
        self.results.pack(fill="both", padx=8, pady=4)
        self.results.bind("<<ListboxSelect>>", lambda _e: self._picked())
        self.results.bind("<Double-Button-1>", lambda _e: self._ok())
        self.hint = tk.Label(self, text="Type part of a name and press Enter. Deleted and hidden things are not listed.", fg="gray")
        self.hint.pack(anchor="w", padx=8)

        row = tk.Frame(self)
        row.pack(fill="x", padx=8, pady=4)
        tk.Label(row, text="Link text").pack(side="left")
        self.label_var = tk.StringVar(value=label)
        self._label_from_user = bool(label)
        tk.Entry(row, textvariable=self.label_var, width=50).pack(side="left", padx=6)
        self.link_var = tk.StringVar()
        tk.Label(self, textvariable=self.link_var, fg="gray", font=("Consolas", 9)).pack(anchor="w", padx=8)

        buttons = tk.Frame(self)
        buttons.pack(fill="x", padx=8, pady=8)
        tk.Button(buttons, text="Cancel", command=self.destroy).pack(side="right")
        tk.Button(buttons, text="Insert", command=self._ok, bg=BLUE, fg="white").pack(side="right", padx=4)
        self.query.focus_set()

    def _kind_code(self):
        return dict(LINK_KINDS)[self.kind.get()]

    def _kind_changed(self):
        self.results.delete(0, "end")
        self.targets = []
        self.link_var.set("")
        page = self._kind_code() == "page"
        state = "disabled" if page else "normal"
        self.query.configure(state=state)
        self.search_button.configure(state=state)
        if page:
            self.targets = [{"label": name, "link": link, "detail": None} for name, link in APP_PAGES]
            for t in self.targets:
                self.results.insert("end", t["label"])
            self.hint.configure(text="A tab or page of the app.")
        else:
            self.hint.configure(text="Type part of a name and press Enter. Deleted and hidden things are not listed.")

    def _search(self):
        found = self.view.call(self.view.session.api().link_targets, self._kind_code(), self.query_var.get().strip())
        if found is None:
            return
        self.targets = found
        self.results.delete(0, "end")
        for t in found:
            self.results.insert("end", t["label"] + (f"   — {t['detail']}" if t.get("detail") else ""))
        self.hint.configure(text=f"{len(found)} found" + (" (the first 20; type more to narrow it down)" if len(found) >= 20 else ""))

    def _picked(self):
        sel = self.results.curselection()
        if not sel:
            return
        target = self.targets[sel[0]]
        self.link_var.set(target["link"])
        if not self._label_from_user:
            self.label_var.set(target["label"])

    def _ok(self):
        link = self.link_var.get()
        if not link:
            self.hint.configure(text="Pick what the link opens first.", fg=RED)
            return
        self.result = md.app_link(self.label_var.get().strip() or link, link)
        self.destroy()


class NewsView(_AdminView):
    def __init__(self, parent, session):
        super().__init__(parent, session, "News")
        self.posts = {}
        self.current = None  # the post as last saved (None: a new, unsaved post)
        self.hero = None
        self.saved = ("", None, "")
        self._photos = {}  # image name → PhotoImage (Tk drops images nobody references)
        self._preview_job = None
        self._selecting = False

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Button(bar, text="Refresh", command=self.refresh, bg=BLUE, fg="white").pack(side="left")
        tk.Button(bar, text="New post", command=self._new_post).pack(side="left", padx=10)
        tk.Label(bar, text="Show").pack(side="left", padx=(10, 4))
        self.filter = ttk.Combobox(bar, values=["all", "draft", "published"], state="readonly", width=10)
        self.filter.current(0)
        self.filter.pack(side="left")
        self.filter.bind("<<ComboboxSelected>>", lambda _e: self.refresh())
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=420, height=660)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        frame, self.tree = _tree(left, ("title", "status", "updated"), {"title": 220, "status": 75, "updated": 110}, height=30)
        frame.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        self.form = tk.Frame(body)
        self.form.pack(side="left", fill="both", expand=True, padx=(14, 0))
        self._build_form(self.form)
        self._show(None)

    # ------------------------------------------------------------------ form

    def _build_form(self, f):
        row = tk.Frame(f)
        row.pack(fill="x")
        tk.Label(row, text="Title").pack(side="left")
        self.title_var = tk.StringVar()
        self.title_var.trace_add("write", lambda *_: self._changed())
        tk.Entry(row, textvariable=self.title_var, width=80, font=("Segoe UI", 11)).pack(side="left", padx=6)
        self.title_count = tk.Label(row, text="", fg="gray")
        self.title_count.pack(side="left")

        row = tk.Frame(f)
        row.pack(fill="x", pady=6)
        tk.Label(row, text="Banner").pack(side="left", anchor="n")
        self.banner = tk.Label(row, text="(no banner)", fg="gray", width=34, height=5, relief="solid", borderwidth=1)
        self.banner.pack(side="left", padx=6)
        side = tk.Frame(row)
        side.pack(side="left", anchor="n")
        tk.Button(side, text="Upload banner…", command=self._upload_banner).pack(anchor="w")
        tk.Button(side, text="Remove banner", command=self._remove_banner).pack(anchor="w", pady=4)
        tk.Label(side, text="Optional. Shown as a 16:9 band on the card and on top of the post.\n"
                            "PNG, JPEG or WebP up to 8 MB; it is re-encoded and resized to 1600 px.",
                 fg="gray", justify="left").pack(anchor="w")

        self._build_toolbar(f)

        panes = tk.Frame(f)
        panes.pack(fill="both", expand=True)
        panes.grid_columnconfigure(0, weight=1, uniform="pane")
        panes.grid_columnconfigure(1, weight=1, uniform="pane")
        panes.grid_rowconfigure(1, weight=1)
        tk.Label(panes, text="Markdown", fg="gray").grid(row=0, column=0, sticky="w")
        tk.Label(panes, text="Preview (how the app shows it)", fg="gray").grid(row=0, column=1, sticky="w", padx=(8, 0))
        self.editor = tk.Text(panes, wrap="word", undo=True, font=("Consolas", 10), height=22)
        self.editor.grid(row=1, column=0, sticky="nsew")
        self.preview = tk.Text(panes, wrap="word", font=("Segoe UI", 10), height=22, state="disabled", bg="#FEFDF0",
                               padx=8, pady=6, cursor="arrow")
        self.preview.grid(row=1, column=1, sticky="nsew", padx=(8, 0))
        self._configure_preview_tags()
        self.editor.bind("<<Modified>>", self._on_edit)
        self.editor.bind("<Control-b>", lambda _e: self._wrap("**", "**"))
        self.editor.bind("<Control-i>", lambda _e: self._wrap("*", "*"))
        self.editor.bind("<Control-k>", lambda _e: self._web_link())
        self.content_count = tk.Label(f, text="", fg="gray", anchor="e")
        self.content_count.pack(fill="x")

        row = tk.Frame(f)
        row.pack(fill="x", pady=(4, 0))
        self.status_var = tk.StringVar()
        tk.Label(row, textvariable=self.status_var, fg="gray").pack(side="left")
        self.delete_button = tk.Button(row, text="Delete", command=self._delete, fg=RED)
        self.delete_button.pack(side="right")
        self.publish_button = tk.Button(row, text="Publish", command=self._toggle_publish)
        self.publish_button.pack(side="right", padx=6)
        self.copy_button = tk.Button(row, text="Copy app link", command=self._copy_link)
        self.copy_button.pack(side="right")
        tk.Button(row, text="Save", command=self._save, bg=BLUE, fg="white", width=10).pack(side="right", padx=6)

    def _build_toolbar(self, f):
        bar = tk.Frame(f)
        bar.pack(fill="x", pady=(0, 4))

        def button(text, command, tip, **font):
            b = tk.Button(bar, text=text, command=command, width=max(3, len(text)), **font)
            b.pack(side="left", padx=1)
            _Tooltip(b, tip)

        def gap():
            tk.Frame(bar, width=10).pack(side="left")

        button("B", lambda: self._wrap("**", "**"), "Bold (Ctrl+B)", font=("Segoe UI", 9, "bold"))
        button("I", lambda: self._wrap("*", "*"), "Italic (Ctrl+I)", font=("Segoe UI", 9, "italic"))
        button("S", lambda: self._wrap("~~", "~~"), "Strikethrough", font=("Segoe UI", 9, "overstrike"))
        gap()
        button("H1", lambda: self._prefix("# "), "Heading 1")
        button("H2", lambda: self._prefix("## "), "Heading 2")
        button("H3", lambda: self._prefix("### "), "Heading 3")
        gap()
        button("• List", lambda: self._prefix("- "), "Bulleted list")
        button("1. List", lambda: self._prefix("1. "), "Numbered list")
        button("❝ Quote", lambda: self._prefix("> "), "Quote")
        gap()
        button("` Code", lambda: self._wrap("`", "`"), "Inline code")
        button("{ } Block", self._code_block, "Code block")
        gap()
        button("— Rule", lambda: self._insert_block("---"), "Horizontal rule")
        button("⊞ Table", lambda: self._insert_block(md.table_template()), "Table (2 × 2 template)")
        gap()
        button("Link…", self._web_link, "Web link (Ctrl+K)")
        button("App link…", self._app_link, "Link that opens a page of the app")
        button("Image…", self._insert_image, "Upload an image into the content")

    # ------------------------------------------------------------------ editor helpers

    def _content(self):
        return self.editor.get("1.0", "end-1c")

    def _selection(self):
        try:
            start, end = self.editor.index("sel.first"), self.editor.index("sel.last")
        except tk.TclError:
            start = end = self.editor.index("insert")
        return len(self.editor.get("1.0", start)), len(self.editor.get("1.0", end))

    def _replace(self, text, sel_start, sel_end):
        """Puts the toolbar's result in the editor as one undo step and selects (or places the cursor at) the result."""
        view = self.editor.yview()[0]
        self.editor.edit_separator()
        self.editor.delete("1.0", "end")
        self.editor.insert("1.0", text)
        self.editor.edit_separator()
        self.editor.tag_remove("sel", "1.0", "end")
        a, b = f"1.0 + {sel_start} chars", f"1.0 + {sel_end} chars"
        if sel_end > sel_start:
            self.editor.tag_add("sel", a, b)
        self.editor.mark_set("insert", b)
        self.editor.yview_moveto(view)
        self.editor.see("insert")
        self.editor.focus_set()

    def _wrap(self, before, after):
        self._replace(*md.wrap(self._content(), *self._selection(), before, after))
        return "break"

    def _prefix(self, prefix):
        self._replace(*md.prefix_lines(self._content(), *self._selection(), prefix))

    def _code_block(self):
        self._replace(*md.code_block(self._content(), *self._selection()))

    def _insert_block(self, block):
        """A rule, table or image goes in as its own paragraph after the selection (selected text is kept)."""
        _, end = self._selection()
        new, pos = md.insert_block(self._content(), end, block)
        self._replace(new, pos, pos)

    def _insert_inline(self, snippet):
        start, end = self._selection()
        text = self._content()
        self._replace(text[:start] + snippet + text[end:], start + len(snippet), start + len(snippet))

    def _selected_text(self):
        start, end = self._selection()
        return self._content()[start:end].strip()

    def _web_link(self):
        snippet = WebLinkDialog(self, self._selected_text()).run()
        if snippet:
            self._insert_inline(snippet)
        return "break"

    def _app_link(self):
        snippet = AppLinkDialog(self, self, self._selected_text()).run()
        if snippet:
            self._insert_inline(snippet)

    def _insert_image(self):
        path = filedialog.askopenfilename(title="Image for the post", filetypes=IMAGE_TYPES)
        if not path:
            return
        name = self.call(self.session.api().upload_news_image, path)
        if name:
            self._insert_block(md.image(name))
            self.info_var.set("Image uploaded: it is saved with the post when you press Save.")

    # ------------------------------------------------------------------ preview

    def _configure_preview_tags(self):
        p = self.preview
        p.tag_configure("h1", font=("Segoe UI", 18, "bold"), spacing1=6)
        p.tag_configure("h2", font=("Segoe UI", 15, "bold"), spacing1=4)
        p.tag_configure("h3", font=("Segoe UI", 12, "bold"), spacing1=2)
        p.tag_configure("bold", font=("Segoe UI", 10, "bold"))
        p.tag_configure("italic", font=("Segoe UI", 10, "italic"))
        p.tag_configure("strike", overstrike=True)
        p.tag_configure("code", font=("Consolas", 10), background="#F4F3E6")
        p.tag_configure("codeblock", font=("Consolas", 10), background="#F4F3E6", lmargin1=10, lmargin2=10)
        p.tag_configure("quote", lmargin1=16, lmargin2=16, foreground="#444444", background="#F6F1DE")
        p.tag_configure("bullet", foreground=GOLD, font=("Segoe UI", 10, "bold"))
        p.tag_configure("rule", foreground=GREY)
        p.tag_configure("table", font=("Consolas", 10))
        p.tag_configure("link", foreground="#1A5FB4", underline=True)

    def _on_edit(self, _event=None):
        if not self.editor.edit_modified():
            return
        self.editor.edit_modified(False)
        self._changed()
        if self._preview_job:
            self.after_cancel(self._preview_job)
        self._preview_job = self.after(300, self._render_preview)

    def _thumbnail(self, name, size):
        key = (name, size)
        if key not in self._photos:
            try:
                from PIL import Image, ImageTk
                img = Image.open(io.BytesIO(self.session.api().news_image(name)))
                img.thumbnail(size)
                self._photos[key] = ImageTk.PhotoImage(img)
            except Exception:  # a missing picture must not break the editor
                self._photos[key] = None
        return self._photos[key]

    def _render_preview(self):
        self._preview_job = None
        p = self.preview
        p.configure(state="normal")
        p.delete("1.0", "end")
        for text, tags in segments(self._content()):
            image = next((t[6:] for t in tags if t.startswith("image:")), None)
            if image:
                photo = self._thumbnail(image, (420, 300))
                if photo:
                    p.image_create("end", image=photo)
                else:
                    p.insert("end", f"[image {image} not found: upload it again]", ("italic",))
                continue
            names = tuple("link" if t.startswith("link:") else t for t in tags)
            p.insert("end", text, names)
        p.configure(state="disabled")

    # ------------------------------------------------------------------ state

    def _state(self):
        return self.title_var.get().strip(), self.hero, self._content()

    def _dirty(self):
        return self._state() != self.saved

    def _changed(self):
        title = self.title_var.get().strip()
        self.title_count.configure(text=f"{len(title)}/{MAX_TITLE}", fg=RED if len(title) > MAX_TITLE else "gray")
        length = len(self._content())
        self.content_count.configure(text=f"{length:,}/{MAX_CONTENT:,} characters", fg=RED if length > MAX_CONTENT else "gray")
        self._update_status()

    def _update_status(self):
        self.status_var.set(status_line(self.current, self._dirty()))
        saved = self.current is not None
        published = saved and self.current["status"] == "published"
        self.publish_button.configure(text="Unpublish" if published else "Publish", state="normal")
        self.copy_button.configure(state="normal" if saved else "disabled")
        self.delete_button.configure(state="normal")

    def _show(self, post):
        """Loads a post (or an empty new one) into the editor."""
        self.current = post
        self.hero = post.get("heroImage") if post else None
        self.title_var.set(post["title"] if post else "")
        self.editor.delete("1.0", "end")
        self.editor.insert("1.0", post["content"] if post else "")
        self.editor.edit_reset()
        self.editor.edit_modified(False)
        self.saved = self._state()
        self._show_banner()
        self._render_preview()
        self._changed()

    def _show_banner(self):
        if not self.hero:
            self.banner.configure(image="", text="(no banner)", width=34, height=5)
            return
        photo = self._thumbnail(self.hero, (240, 135))
        if photo:
            self.banner.configure(image=photo, text="", width=240, height=135)
        else:
            self.banner.configure(image="", text=f"(banner {self.hero} not found)", width=34, height=5)

    def can_leave(self):
        """Asked before another post or another tab is shown: save, discard or stay."""
        if not self._dirty():
            return True
        answer = messagebox.askyesnocancel("Coffer.Manager", "This post has unsaved changes. Save them?", parent=self)
        if answer is None:
            return False
        return self._save() if answer else True

    # ------------------------------------------------------------------ list

    def refresh(self):
        result = self.call(self.session.api().news, self.filter.get())
        if result is None:
            return
        self.posts = {p["id"]: p for p in result["items"]}
        self._selecting = True
        try:
            self.tree.delete(*self.tree.get_children())
            for p in result["items"]:
                status = "published" if p["status"] == "published" else "draft"
                title = p["title"] + ("  (edited)" if p.get("editedAt") else "")
                self.tree.insert("", "end", iid=p["id"], values=(title, status, _when(p["updatedAt"])))
            if self.current and self.current["id"] in self.posts:
                self.tree.selection_set(self.current["id"])
                self.tree.see(self.current["id"])
        finally:
            self.after_idle(lambda: setattr(self, "_selecting", False))
        self.info_var.set(f"{result['total']} posts")

    def _on_select(self, _event):
        if self._selecting:
            return
        sel = self.tree.selection()
        if not sel or (self.current and sel[0] == self.current["id"]):
            return
        if not self.can_leave():
            self._selecting = True
            if self.current:
                self.tree.selection_set(self.current["id"])
            else:
                self.tree.selection_remove(*sel)
            self.after_idle(lambda: setattr(self, "_selecting", False))
            return
        post = self.call(self.session.api().news_post, sel[0])
        if post:
            self._show(post)

    def _new_post(self):
        if not self.can_leave():
            return
        self._selecting = True
        self.tree.selection_remove(*self.tree.selection())
        self.after_idle(lambda: setattr(self, "_selecting", False))
        self._show(None)

    # ------------------------------------------------------------------ actions

    def _upload_banner(self):
        path = filedialog.askopenfilename(title="Banner image", filetypes=IMAGE_TYPES)
        if not path:
            return
        name = self.call(self.session.api().upload_news_image, path)
        if name:
            self.hero = name
            self._show_banner()
            self._changed()

    def _remove_banner(self):
        self.hero = None
        self._show_banner()
        self._changed()

    def _save(self):
        """Saves the post (creates it when new). True when saved."""
        title, hero, content = self._state()
        if not title:
            messagebox.showerror("Coffer.Manager", "The post needs a title.", parent=self)
            return False
        if len(title) > MAX_TITLE or len(content) > MAX_CONTENT:
            messagebox.showerror("Coffer.Manager", f"The title can be at most {MAX_TITLE} and the content "
                                                   f"{MAX_CONTENT:,} characters.", parent=self)
            return False
        body = {"title": title, "heroImage": hero, "content": content}
        api = self.session.api()
        post = self.call(api.create_news, body) if self.current is None else self.call(api.update_news, self.current["id"], body)
        if not post:
            return False
        self.current = post
        self.saved = self._state()
        self._update_status()
        self.refresh()
        self.info_var.set("Saved" + (" (the app shows it as edited)" if post.get("editedAt") and post["status"] == "published" else ""))
        return True

    def _toggle_publish(self):
        if self._dirty() or self.current is None:
            if not messagebox.askyesno("Coffer.Manager", "Save the post first?", parent=self) or not self._save():
                return
        publish = self.current["status"] != "published"
        if publish and not messagebox.askyesno("Coffer.Manager", f"Publish \"{self.current['title']}\"? Everyone sees it "
                                                                 f"in the app's News.", parent=self):
            return
        post = self.call(self.session.api().publish_news, self.current["id"], publish)
        if post:
            self.current = post
            self._update_status()
            self.refresh()
            self.info_var.set("Published" if publish else "Unpublished: the app no longer shows it")

    def _delete(self):
        if self.current is None:
            if self._dirty() and not messagebox.askyesno("Coffer.Manager", "Discard this new post?", parent=self):
                return
            self._show(None)
            return
        if not messagebox.askyesno("Coffer.Manager", f"Delete \"{self.current['title']}\" for good? Its images are "
                                                     f"deleted too (unless another post uses them).", parent=self):
            return
        self.info_var.set("")
        self.call(self.session.api().delete_news, self.current["id"])
        if self.info_var.get().startswith("Error"):
            return
        self._show(None)
        self.refresh()
        self.info_var.set("Deleted")

    def _copy_link(self):
        if not self.current:
            return
        link = f"coffer://news/{self.current['id']}"
        self.clipboard_clear()
        self.clipboard_append(link)
        self.info_var.set(f"Copied {link}")


class _Tooltip:
    """A small hint under a toolbar button while the mouse is over it."""

    def __init__(self, widget, text):
        self.widget, self.text, self.tip = widget, text, None
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)

    def _show(self, _event):
        if self.tip:
            return
        x = self.widget.winfo_rootx()
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 2
        self.tip = tk.Toplevel(self.widget)
        self.tip.wm_overrideredirect(True)
        self.tip.wm_geometry(f"+{x}+{y}")
        tk.Label(self.tip, text=self.text, background="#FFFFE0", relief="solid", borderwidth=1).pack()

    def _hide(self, _event):
        if self.tip:
            self.tip.destroy()
            self.tip = None
