"""Item types and option sets of Coffer.Manager (administrators only; the backend checks every request).

Item types: names, colour, icon, AI models, attributes and the publish switch. A new type starts hidden and can be
published once both AI models, one primary attribute and an icon exist. Translations are edited as the stored JSON
(language code -> text); an empty box shows a grey example that is never saved.
"""
import io
import tkinter as tk
from tkinter import colorchooser, filedialog, messagebox, ttk

from itemtypes.formatting import (DATA_TYPES, DATA_TYPE_NAMES, OPTION_TYPES, attribute_row, blockers_text, models_text,
                                  option_set_row, type_row)
from itemtypes.translations import parse, placeholder, to_text
from reports.view import _AdminView, _tree

GREY = "#9A9A9A"
RED = "#B3261E"
MODEL_WARNING = "A model file can run code on the AI server: upload only models you trained yourself."


class JsonBox(tk.Frame):
    """A translations JSON box: shows the stored JSON, or a grey example when empty (never saved)."""

    def __init__(self, parent, label, height=3):
        super().__init__(parent)
        tk.Label(self, text=label).pack(anchor="w")
        self.text = tk.Text(self, height=height, width=60, wrap="word", font=("Consolas", 9))
        self.text.pack(fill="x")
        self.text.tag_configure("placeholder", foreground=GREY)
        self.error = tk.Label(self, text="", fg=RED, anchor="w", justify="left")
        self.error.pack(fill="x")
        self.example = ""
        self.text.bind("<FocusIn>", self._focus_in)
        self.text.bind("<FocusOut>", self._focus_out)

    def show(self, translations, example):
        self.example = example
        self.error.configure(text="")
        self.text.delete("1.0", "end")
        value = to_text(translations)
        if value:
            self.text.insert("1.0", value)
        else:
            self._show_example()

    def set_example(self, example):
        """New example (e.g. the option count changed); replaces the shown one only while the box is untouched."""
        showing = self._showing_example()
        self.example = example
        if showing:
            self._show_example()

    def _show_example(self):
        self.text.delete("1.0", "end")
        self.text.insert("1.0", self.example, "placeholder")

    def _showing_example(self):
        return bool(self.text.tag_ranges("placeholder"))

    def _focus_in(self, _event):
        if self._showing_example():
            self.text.delete("1.0", "end")

    def _focus_out(self, _event):
        if not self.text.get("1.0", "end").strip():
            self._show_example()

    def value(self, part_count=None):
        """Parsed translations; shows the problem under the box and returns None when the JSON is wrong."""
        raw = "" if self._showing_example() else self.text.get("1.0", "end")
        try:
            result = parse(raw, part_count)
        except ValueError as e:
            self.error.configure(text=str(e))
            return None
        self.error.configure(text="")
        return result


class ItemTypesView(_AdminView):
    def __init__(self, parent, session):
        super().__init__(parent, session, "Item types")
        self.types = {}
        self.current = None
        self.option_sets = []
        self._icon_photo = None

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Button(bar, text="Refresh", command=self.refresh, bg="#2E86C1", fg="white").pack(side="left")
        tk.Button(bar, text="New item type", command=self._new_type).pack(side="left", padx=10)
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=430, height=640)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        frame, self.tree = _tree(left, ("name", "state", "models", "used"),
                                 {"name": 150, "state": 75, "models": 100, "used": 70}, height=28)
        frame.pack(fill="both", expand=True)
        self.tree.heading("used", text="Collections / listings")
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        self.form = tk.Frame(body)
        self.form.pack(side="left", fill="both", expand=True, padx=(14, 0))
        self._build_form(self.form)

    # ------------------------------------------------------------------ form

    def _build_form(self, f):
        row = tk.Frame(f)
        row.pack(fill="x")
        tk.Label(row, text="Name").pack(side="left")
        self.name_var = tk.StringVar()
        tk.Entry(row, textvariable=self.name_var, width=30).pack(side="left", padx=5)
        tk.Label(row, text="Colour").pack(side="left", padx=(15, 0))
        self.color_var = tk.StringVar()
        tk.Entry(row, textvariable=self.color_var, width=10).pack(side="left", padx=5)
        self.swatch = tk.Label(row, text="      ", relief="solid", borderwidth=1)
        self.swatch.pack(side="left")
        tk.Button(row, text="Pick…", command=self._pick_color).pack(side="left", padx=5)
        self.color_var.trace_add("write", lambda *_: self._update_swatch())

        self.name_tr = JsonBox(f, "Name translations (JSON)")
        self.name_tr.pack(fill="x", pady=(6, 0))
        tk.Label(f, text="Description").pack(anchor="w")
        self.description_var = tk.StringVar()
        tk.Entry(f, textvariable=self.description_var, width=90).pack(fill="x")
        self.description_tr = JsonBox(f, "Description translations (JSON)")
        self.description_tr.pack(fill="x", pady=(6, 0))

        files = tk.Frame(f)
        files.pack(fill="x", pady=4)
        self.icon_label = tk.Label(files, text="(no icon)", width=10, height=4, relief="groove")
        self.icon_label.pack(side="left")
        tk.Button(files, text="Upload icon…", command=self._upload_icon).pack(side="left", padx=8)
        models = tk.Frame(files)
        models.pack(side="left", fill="x", expand=True, padx=10)
        self.models_var = tk.StringVar()
        tk.Label(models, textvariable=self.models_var, anchor="w", justify="left").pack(anchor="w")
        tk.Button(models, text="Upload models…", command=self._upload_models).pack(anchor="w")

        publish = tk.Frame(f)
        publish.pack(fill="x", pady=4)
        self.published_var = tk.BooleanVar()
        self.publish_check = tk.Checkbutton(publish, text="Published (shown in the app)", variable=self.published_var,
                                            command=self._toggle_published)
        self.publish_check.pack(side="left")
        self.blockers_var = tk.StringVar()
        tk.Label(publish, textvariable=self.blockers_var, fg="gray").pack(side="left", padx=10)

        tk.Label(f, text="Attributes").pack(anchor="w", pady=(6, 0))
        frame, self.attr_tree = _tree(f, ("name", "type", "primary", "required", "options", "used"),
                                      {"name": 160, "type": 100, "primary": 70, "required": 70, "options": 80, "used": 80}, height=7)
        frame.pack(fill="x")
        self.attr_tree.bind("<Double-1>", lambda _e: self._edit_attribute())
        buttons = tk.Frame(f)
        buttons.pack(fill="x", pady=4)
        tk.Button(buttons, text="Add attribute", command=self._add_attribute).pack(side="left")
        tk.Button(buttons, text="Edit attribute", command=self._edit_attribute).pack(side="left", padx=5)
        self.delete_attr_button = tk.Button(buttons, text="Delete attribute", command=self._delete_attribute)
        self.delete_attr_button.pack(side="left")
        self.attr_tree.bind("<<TreeviewSelect>>", lambda _e: self._update_attribute_buttons())

        actions = tk.Frame(f)
        actions.pack(fill="x", pady=8)
        tk.Button(actions, text="Save", command=self._save, bg="#2E86C1", fg="white", width=12).pack(side="left")
        self.delete_type_button = tk.Button(actions, text="Delete item type", command=self._delete_type, fg=RED)
        self.delete_type_button.pack(side="right")
        self._set_form_state(False)

    def _set_form_state(self, enabled):
        state = "normal" if enabled else "disabled"
        for child in self.form.winfo_children():
            self._set_state(child, state)

    def _set_state(self, widget, state):
        try:
            if not isinstance(widget, (tk.Frame, tk.Label, ttk.Treeview, ttk.Scrollbar)):
                widget.configure(state=state)
        except tk.TclError:
            pass
        for child in widget.winfo_children():
            self._set_state(child, state)

    def _update_swatch(self):
        try:
            self.swatch.configure(bg=self.color_var.get())
        except tk.TclError:
            self.swatch.configure(bg=self.cget("bg"))

    def _pick_color(self):
        _, color = colorchooser.askcolor(color=self.color_var.get() or None, parent=self)
        if color:
            self.color_var.set(color.upper())

    # ------------------------------------------------------------------ loading

    def refresh(self):
        types = self.call(self.session.api().item_types)
        if types is None:
            return
        self.option_sets = self.call(self.session.api().option_sets) or []
        self.types = {str(t["id"]): t for t in types}
        self.tree.delete(*self.tree.get_children())
        for t in types:
            self.tree.insert("", "end", iid=str(t["id"]), values=type_row(t))
        self.info_var.set(f"{len(types)} item type(s)")
        if self.current and str(self.current["id"]) in self.types:
            self.tree.selection_set(str(self.current["id"]))
            self._show(self.types[str(self.current["id"])])
        elif self.current is None:
            self._set_form_state(False)

    def _on_select(self, _event):
        selected = self.tree.selection()
        if selected:
            self._show(self.types[selected[0]])

    def _show(self, t):
        self.current = t
        self._set_form_state(True)
        self.name_var.set(t["name"])
        self.color_var.set(t["color"])
        self.description_var.set(t.get("description") or "")
        self.name_tr.show(t.get("nameTranslations"), placeholder("name"))
        self.description_tr.show(t.get("descriptionTranslations"), placeholder("description"))
        self.models_var.set(models_text(t))
        self.published_var.set(bool(t.get("published")))
        self.blockers_var.set("" if t.get("published") else blockers_text(t))
        self.publish_check.configure(state="normal" if t.get("published") or not t.get("publishBlockers") else "disabled")
        unused = t.get("collections", 0) == 0 and t.get("listings", 0) == 0 and not t.get("published")
        self.delete_type_button.configure(state="normal" if unused else "disabled")
        self.attr_tree.delete(*self.attr_tree.get_children())
        for a in t.get("attributes", []):
            self.attr_tree.insert("", "end", iid=str(a["id"]), values=attribute_row(a))
        self._update_attribute_buttons()
        self._show_icon(t.get("icon"))

    def _show_icon(self, file_name):
        self.icon_label.configure(image="", text="(no icon)")
        self._icon_photo = None
        if not file_name:
            return
        try:
            from PIL import Image, ImageTk
            img = Image.open(io.BytesIO(self.session.api().icon(file_name)))
            img.thumbnail((64, 64))
            self._icon_photo = ImageTk.PhotoImage(img)
            self.icon_label.configure(image=self._icon_photo, text="", width=64, height=64)
        except Exception as e:  # the preview is a nice-to-have
            self.icon_label.configure(text=f"(icon: {e.__class__.__name__})")

    def _replace(self, updated):
        if updated:
            self.types[str(updated["id"])] = updated
            self.current = updated
            self.refresh()

    # ------------------------------------------------------------------ item type actions

    def _body(self):
        names = self.name_tr.value()
        descriptions = self.description_tr.value()
        if names is None or descriptions is None:
            return None
        return {"name": self.name_var.get().strip(), "nameTranslations": names, "description": self.description_var.get().strip(),
                "descriptionTranslations": descriptions, "color": self.color_var.get().strip()}

    def _save(self):
        if not self.current:
            return
        body = self._body()
        if body is None:
            return
        updated = self.call(self.session.api().update_item_type, self.current["id"], body)
        if updated:
            self.info_var.set(f"Saved {updated['name']}.")
            self._replace(updated)

    def _new_type(self):
        dialog = _NameColorDialog(self)
        self.wait_window(dialog)
        if not dialog.result:
            return
        created = self.call(self.session.api().create_item_type, {**dialog.result, "nameTranslations": {}, "description": "",
                                                                   "descriptionTranslations": {}})
        if created:
            self.info_var.set(f"Created {created['name']} (hidden until published).")
            self.current = created
            self.refresh()

    def _delete_type(self):
        if not self.current or not messagebox.askyesno("Coffer.Manager", f"Delete the item type {self.current['name']}?\n"
                                                       "Its icon and AI model files are deleted too.", parent=self):
            return
        if self.call(self.session.api().delete_item_type, self.current["id"]) is None and self.info_var.get().startswith("Error"):
            return
        self.info_var.set(f"Deleted {self.current['name']}.")
        self.current = None
        self.refresh()

    def _toggle_published(self):
        if not self.current:
            return
        wanted = self.published_var.get()
        if not wanted and not messagebox.askyesno(
                "Coffer.Manager", f"Hide {self.current['name']} from the app?\n\nNothing is deleted: its collections, items and "
                                  "listings disappear for everyone until you publish it again. Deals in progress keep working.",
                parent=self):
            self.published_var.set(True)
            return
        updated = self.call(self.session.api().set_published, self.current["id"], wanted)
        if updated is None:
            self.published_var.set(not wanted)
            return
        self._replace(updated)

    def _upload_icon(self):
        if not self.current:
            return
        path = filedialog.askopenfilename(parent=self, title="Icon (PNG, JPEG or WebP, at most 1 MB)",
                                          filetypes=[("Images", "*.png *.jpg *.jpeg *.webp")])
        if path:
            self._replace(self.call(self.session.api().upload_icon, self.current["id"], path))

    def _upload_models(self):
        if not self.current:
            return
        dialog = _ModelsDialog(self, self.current)
        self.wait_window(dialog)
        if not dialog.result:
            return
        self.info_var.set("Uploading models… this can take a few minutes.")
        self.update_idletasks()
        updated = self.call(self.session.api().upload_models, self.current["id"], **dialog.result)
        if updated:
            self.info_var.set("Models uploaded.")
            self._replace(updated)

    # ------------------------------------------------------------------ attributes

    def _selected_attribute(self):
        selected = self.attr_tree.selection()
        if not selected or not self.current:
            return None
        return next((a for a in self.current.get("attributes", []) if str(a["id"]) == selected[0]), None)

    def _update_attribute_buttons(self):
        a = self._selected_attribute()
        self.delete_attr_button.configure(state="normal" if a and not a.get("usedByItems") else "disabled")

    def _add_attribute(self):
        if not self.current:
            return
        dialog = _AttributeDialog(self, None, self.option_sets)
        self.wait_window(dialog)
        if dialog.result and self.call(self.session.api().add_attribute, self.current["id"], dialog.result):
            self._replace(self.call(self.session.api().item_type, self.current["id"]))

    def _edit_attribute(self):
        a = self._selected_attribute()
        if not a:
            return
        dialog = _AttributeDialog(self, a, self.option_sets)
        self.wait_window(dialog)
        if dialog.result and self.call(self.session.api().update_attribute, a["id"], dialog.result):
            self._replace(self.call(self.session.api().item_type, self.current["id"]))

    def _delete_attribute(self):
        a = self._selected_attribute()
        if not a or not messagebox.askyesno("Coffer.Manager", f"Delete the attribute {a['name']}?", parent=self):
            return
        self.call(self.session.api().delete_attribute, a["id"])
        self._replace(self.call(self.session.api().item_type, self.current["id"]))


class _Dialog(tk.Toplevel):
    def __init__(self, parent, title):
        super().__init__(parent)
        self.title(title)
        self.transient(parent)
        self.resizable(False, False)
        self.result = None
        self.body = tk.Frame(self, padx=12, pady=10)
        self.body.pack(fill="both", expand=True)

    def buttons(self, ok_text="OK"):
        bar = tk.Frame(self.body)
        bar.pack(fill="x", pady=(10, 0))
        tk.Button(bar, text=ok_text, command=self._ok, bg="#2E86C1", fg="white", width=12).pack(side="right")
        tk.Button(bar, text="Cancel", command=self.destroy).pack(side="right", padx=6)
        self.grab_set()

    def _ok(self):
        raise NotImplementedError


class _NameColorDialog(_Dialog):
    def __init__(self, parent):
        super().__init__(parent, "New item type")
        tk.Label(self.body, text="Name").pack(anchor="w")
        self.name_var = tk.StringVar()
        tk.Entry(self.body, textvariable=self.name_var, width=40).pack(fill="x")
        tk.Label(self.body, text="Colour (#RRGGBB)").pack(anchor="w", pady=(6, 0))
        self.color_var = tk.StringVar(value="#A98D3C")
        tk.Entry(self.body, textvariable=self.color_var, width=12).pack(anchor="w")
        tk.Label(self.body, text="It starts hidden: add attributes, an icon and both AI models, then publish it.",
                 fg="gray").pack(anchor="w", pady=(8, 0))
        self.buttons("Create")

    def _ok(self):
        self.result = {"name": self.name_var.get().strip(), "color": self.color_var.get().strip()}
        self.destroy()


class _ModelsDialog(_Dialog):
    def __init__(self, parent, item_type):
        super().__init__(parent, f"AI models of {item_type['name']}")
        self.detection_var = tk.StringVar()
        self.embedding_var = tk.StringVar()
        self.classes_var = tk.StringVar(value=str((item_type.get("embedding") or {}).get("classCount") or ""))
        for label, var in (("Object detection model (.pt)", self.detection_var), ("Embedding model (.pt)", self.embedding_var)):
            tk.Label(self.body, text=label).pack(anchor="w", pady=(6, 0))
            row = tk.Frame(self.body)
            row.pack(fill="x")
            tk.Entry(row, textvariable=var, width=60).pack(side="left")
            tk.Button(row, text="Browse…", command=lambda v=var: self._browse(v)).pack(side="left", padx=5)
        tk.Label(self.body, text="Embedding model's class count").pack(anchor="w", pady=(6, 0))
        tk.Entry(self.body, textvariable=self.classes_var, width=10).pack(anchor="w")
        tk.Label(self.body, text="Leave a file empty to keep the current one.", fg="gray").pack(anchor="w", pady=(6, 0))
        tk.Label(self.body, text=MODEL_WARNING, fg=RED, wraplength=460, justify="left").pack(anchor="w", pady=(6, 0))
        self.buttons("Upload")

    def _browse(self, var):
        path = filedialog.askopenfilename(parent=self, filetypes=[("PyTorch model", "*.pt")])
        if path:
            var.set(path)

    def _ok(self):
        detection, embedding = self.detection_var.get().strip(), self.embedding_var.get().strip()
        if not detection and not embedding:
            messagebox.showerror("Coffer.Manager", "Choose at least one model file.", parent=self)
            return
        class_count = None
        if embedding:
            try:
                class_count = int(self.classes_var.get().strip())
            except ValueError:
                messagebox.showerror("Coffer.Manager", "The embedding model needs its class count (a whole number).", parent=self)
                return
        self.result = {"detection_path": detection or None, "embedding_path": embedding or None, "class_count": class_count}
        self.destroy()


class _AttributeDialog(_Dialog):
    def __init__(self, parent, attribute, option_sets):
        super().__init__(parent, "Edit attribute" if attribute else "New attribute")
        a = attribute or {}
        used = a.get("usedByItems", 0)
        self.sets = {f"#{s['id']}: {option_set_row(s)[1]}": s["id"] for s in option_sets}

        tk.Label(self.body, text="Name").pack(anchor="w")
        self.name_var = tk.StringVar(value=a.get("name", ""))
        tk.Entry(self.body, textvariable=self.name_var, width=40).pack(fill="x")
        self.translations = JsonBox(self.body, "Name translations (JSON)")
        self.translations.pack(fill="x", pady=(6, 0))
        self.translations.show(a.get("nameTranslations"), placeholder("name"))

        tk.Label(self.body, text="Data type").pack(anchor="w")
        self.type_var = tk.StringVar(value=DATA_TYPE_NAMES.get(a.get("dataType", 0)))
        type_box = ttk.Combobox(self.body, textvariable=self.type_var, values=[n for _, n in DATA_TYPES], state="readonly", width=20)
        type_box.pack(anchor="w")
        tk.Label(self.body, text="Option set (select, multi-select, autocomplete)").pack(anchor="w", pady=(6, 0))
        current = next((label for label, sid in self.sets.items() if sid == a.get("optionSetId")), "")
        self.set_var = tk.StringVar(value=current)
        set_box = ttk.Combobox(self.body, textvariable=self.set_var, values=[""] + list(self.sets), state="readonly", width=50)
        set_box.pack(anchor="w")
        if used:
            type_box.configure(state="disabled")
            set_box.configure(state="disabled")
            tk.Label(self.body, text=f"{used} item(s) have a value: the data type and option set can't change.",
                     fg="gray").pack(anchor="w")

        self.primary_var = tk.BooleanVar(value=a.get("primary", False))
        self.required_var = tk.BooleanVar(value=a.get("required", False))
        tk.Checkbutton(self.body, text="Primary (names the item; only one per item type)", variable=self.primary_var).pack(anchor="w", pady=(6, 0))
        tk.Checkbutton(self.body, text="Required before an item is added", variable=self.required_var).pack(anchor="w")
        self.buttons("Save")

    def _ok(self):
        translations = self.translations.value()
        if translations is None:
            return
        data_type = next(code for code, name in DATA_TYPES if name == self.type_var.get())
        option_set = self.sets.get(self.set_var.get()) if data_type in OPTION_TYPES else None
        self.result = {"name": self.name_var.get().strip(), "nameTranslations": translations, "dataType": data_type,
                       "primary": self.primary_var.get(), "required": self.required_var.get(), "optionSetId": option_set}
        self.destroy()


class OptionSetsView(_AdminView):
    """The lists select attributes pick from. Options items use can't be removed; labels can always change."""

    def __init__(self, parent, session):
        super().__init__(parent, session, "Option sets")
        self.sets = {}
        self.current = None
        self.options = []

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Button(bar, text="Refresh", command=self.refresh, bg="#2E86C1", fg="white").pack(side="left")
        tk.Button(bar, text="New option set", command=self._new_set).pack(side="left", padx=10)
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=620, height=640)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        frame, self.tree = _tree(left, ("id", "options", "used by"), {"id": 40, "options": 330, "used by": 230}, height=28)
        frame.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        right = tk.Frame(body)
        right.pack(side="left", fill="both", expand=True, padx=(14, 0))
        frame, self.option_tree = _tree(right, ("id", "label", "used"), {"id": 50, "label": 260, "used": 90}, height=12)
        frame.pack(fill="x")
        self.option_tree.bind("<<TreeviewSelect>>", lambda _e: self._on_option_select())
        row = tk.Frame(right)
        row.pack(fill="x", pady=4)
        self.label_var = tk.StringVar()
        tk.Entry(row, textvariable=self.label_var, width=36).pack(side="left")
        tk.Button(row, text="Add option", command=self._add_option).pack(side="left", padx=5)
        tk.Button(row, text="Rename selected", command=self._rename_option).pack(side="left")
        self.remove_button = tk.Button(row, text="Remove selected", command=self._remove_option, state="disabled")
        self.remove_button.pack(side="left", padx=5)
        self.translations = JsonBox(right, "Label translations (JSON, one label per option, separated by ';')", height=4)
        self.translations.pack(fill="x", pady=(6, 0))
        actions = tk.Frame(right)
        actions.pack(fill="x", pady=8)
        tk.Button(actions, text="Save", command=self._save, bg="#2E86C1", fg="white", width=12).pack(side="left")
        self.delete_button = tk.Button(actions, text="Delete option set", command=self._delete_set, fg=RED, state="disabled")
        self.delete_button.pack(side="right")

    def refresh(self):
        sets = self.call(self.session.api().option_sets)
        if sets is None:
            return
        self.sets = {str(s["id"]): s for s in sets}
        self.tree.delete(*self.tree.get_children())
        for s in sets:
            self.tree.insert("", "end", iid=str(s["id"]), values=option_set_row(s))
        self.info_var.set(f"{len(sets)} option set(s)")
        if self.current and str(self.current["id"]) in self.sets:
            self.tree.selection_set(str(self.current["id"]))
            self._show(self.sets[str(self.current["id"])])

    def _on_select(self, _event):
        selected = self.tree.selection()
        if selected:
            self._show(self.sets[selected[0]])

    def _show(self, s):
        self.current = s
        self.options = [dict(o) for o in s.get("options", [])]
        self._render_options()
        self.translations.show(s.get("labelTranslations"), placeholder("options", [o["label"] for o in self.options]))
        self.delete_button.configure(state="disabled" if s.get("usedBy") else "normal")

    def _render_options(self):
        self.option_tree.delete(*self.option_tree.get_children())
        for i, o in enumerate(self.options):
            self.option_tree.insert("", "end", iid=str(i), values=(o.get("id") or "new", o["label"], f"{o.get('usedByItems', 0)} items"))
        self.translations.set_example(placeholder("options", [o["label"] for o in self.options]))
        self.remove_button.configure(state="disabled")

    def _selected_index(self):
        selected = self.option_tree.selection()
        return int(selected[0]) if selected else None

    def _on_option_select(self):
        i = self._selected_index()
        if i is None:
            return
        self.label_var.set(self.options[i]["label"])
        self.remove_button.configure(state="disabled" if self.options[i].get("usedByItems") else "normal")

    def _add_option(self):
        label = self.label_var.get().strip()
        if label:
            self.options.append({"id": None, "label": label, "usedByItems": 0})
            self.label_var.set("")
            self._render_options()

    def _rename_option(self):
        i, label = self._selected_index(), self.label_var.get().strip()
        if i is not None and label:
            self.options[i]["label"] = label
            self._render_options()

    def _remove_option(self):
        i = self._selected_index()
        if i is not None and not self.options[i].get("usedByItems"):
            del self.options[i]
            self._render_options()

    def _body(self):
        translations = self.translations.value(part_count=len(self.options))
        if translations is None:
            return None
        return {"options": [{"id": o.get("id"), "label": o["label"]} for o in self.options], "labelTranslations": translations}

    def _save(self):
        body = self._body()
        if body is None:
            return
        if self.current and self.current.get("id"):
            saved = self.call(self.session.api().update_option_set, self.current["id"], body)
        else:
            saved = self.call(self.session.api().create_option_set, body)
        if saved:
            self.current = saved
            self.info_var.set(f"Saved option set #{saved['id']}.")
            self.refresh()

    def _new_set(self):
        self.tree.selection_remove(*self.tree.selection())
        self.current = {"id": None, "options": [], "labelTranslations": {}, "usedBy": []}
        self._show(self.current)
        self.info_var.set("New option set: add its options, then Save.")

    def _delete_set(self):
        if not self.current or not self.current.get("id"):
            return
        if not messagebox.askyesno("Coffer.Manager", f"Delete option set #{self.current['id']}?", parent=self):
            return
        self.call(self.session.api().delete_option_set, self.current["id"])
        self.current = None
        self.option_tree.delete(*self.option_tree.get_children())
        self.refresh()
