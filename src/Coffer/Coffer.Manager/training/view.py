"""Model training in Coffer.Manager: train the cap detection and cap embedding models, see how they do on a test set
of photos they never saw (next to the model that is live now), and put a finished model to use for an item type.

Each run is its own process (python -m training.worker <run folder>) writing a run folder; this view starts runs,
watches their progress.json / log.txt / report.json, stops them (STOP file, then terminate) and uploads models.
"""
import os
import subprocess
import sys
import threading
import tkinter as tk
from dataclasses import fields
from tkinter import filedialog, messagebox, ttk
from typing import Optional, get_args

from training import config, runs
from training.coffer_models import BACKBONES
from training.config import LOSSES, DetectionConfig, EmbeddingConfig
from reports.view import _AdminView, _tree

MANAGER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_RUNS_DIR = os.path.join(os.path.expanduser("~"), "CofferRuns")
LIVE_BASE = "Live model of the compare type"
BASE_MODELS = ("yolov8n.pt", "yolov8s.pt", "yolo11n.pt", "yolo11s.pt", LIVE_BASE)
NO_TYPE = "(none)"
POLL_MS = 1000
STOP_GRACE_MS = 30_000
GREY = "#9A9A9A"
RED = "#B3261E"
BLUE = "#2E86C1"
GREEN = "#2E7D32"

# (field, label, choices) — choices None = text entry, "bool" = checkbox, tuple = drop-down.
SETTINGS = {
    "embedding": [
        ("backbone", "Backbone", BACKBONES),
        ("pretrained", "Start from ImageNet weights", "bool"),
        ("embedding_dim", "Embedding size", None),
        ("image_size", "Image size (px)", None),
        ("frozen_stages", "Frozen backbone stages (0–4)", None),
        ("epochs", "Epochs (at most)", None),
        ("patience", "Stop after epochs without improvement", None),
        ("classes_per_batch", "Caps per batch", None),
        ("images_per_class", "Photos per cap in a batch", None),
        ("lr", "Learning rate", None),
        ("loss", "Loss", LOSSES),
        ("val_fraction", "Validation share of training caps", None),
        ("seed", "Seed", None),
    ],
    "detection": [
        ("base_model", "Base model", BASE_MODELS),
        ("epochs", "Epochs (at most)", None),
        ("imgsz", "Image size (multiple of 32)", None),
        ("batch", "Batch", None),
        ("patience", "Stop after epochs without improvement", None),
        ("freeze", "Frozen layers (0 = none, 10 = backbone)", None),
        ("lr0", "Learning rate", None),
        ("val_fraction", "Validation share (whole sessions)", None),
        ("seed", "Seed", None),
    ],
}
AUGMENTATION = {
    "embedding": [
        ("perspective", "Perspective (0–0.5)"),
        ("brightness", "Brightness"),
        ("contrast", "Contrast"),
        ("saturation", "Saturation"),
        ("hue", "Hue shift (max 0.02)"),
        ("blur_p", "Blur probability"),
        ("erasing_p", "Erasing probability"),
    ],
    "detection": [
        ("degrees", "Rotation (degrees)"),
        ("scale", "Scale"),
        ("translate", "Translate"),
        ("fliplr", "Horizontal flip probability"),
        ("mosaic", "Mosaic"),
        ("hsv_h", "HSV hue"),
        ("hsv_s", "HSV saturation"),
        ("hsv_v", "HSV value"),
    ],
}
NOTES = {
    "embedding": "Training data: one folder per cap variant (the folder name is the class). Test set: a separate "
                 "folder of caps that are NOT in the training data, ideally photographed on other days. "
                 "No flips are used: mirrored text is not the same cap.",
    "detection": "Training data and test set: Label Studio \"YOLO\" exports (images/, labels/, classes.txt with one "
                 "class). Validation photos are held out from the training data by capture session.",
}
CLASSES = {"embedding": EmbeddingConfig, "detection": DetectionConfig}


def device_text() -> str:
    try:
        import torch
        if torch.cuda.is_available():
            return f"Training on {torch.cuda.get_device_name(0)} (CUDA)"
        return "Training on the CPU (no CUDA GPU found): expect long runs"
    except Exception as e:  # torch missing or broken
        return f"PyTorch unavailable: {e}"


class SettingsForm(tk.Frame):
    """The settings of one model kind, bound to its config dataclass."""

    def __init__(self, parent, view, kind):
        super().__init__(parent)
        self.view, self.kind = view, kind
        self.vars = {}
        cls = CLASSES[kind]
        defaults = cls(name="", train_dir="", test_dir="")

        top = tk.Frame(self)
        top.pack(fill="x", padx=8, pady=(8, 4))
        top.grid_columnconfigure(1, weight=1)
        self._entry(top, 0, "name", "Run name", width=40)
        self._folder(top, 1, "train_dir", "Training data")
        self._folder(top, 2, "test_dir", "Test set (required)")
        tk.Label(top, text="Compare with item type").grid(row=3, column=0, sticky="w", pady=2)
        self.vars["compare"] = tk.StringVar(value=NO_TYPE)
        self.compare_box = ttk.Combobox(top, textvariable=self.vars["compare"], state="readonly", width=38)
        self.compare_box.grid(row=3, column=1, sticky="w", pady=2)
        tk.Label(top, text=NOTES[kind], fg="gray", wraplength=900, justify="left").grid(row=4, column=0, columnspan=3, sticky="w", pady=(4, 0))

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=8)
        left = tk.LabelFrame(body, text="Training", padx=8, pady=6)
        left.pack(side="left", fill="y", anchor="n")
        right = tk.LabelFrame(body, text="Augmentation", padx=8, pady=6)
        right.pack(side="left", fill="y", anchor="n", padx=(12, 0))
        for row, (name, label, choices) in enumerate(SETTINGS[kind]):
            value = getattr(defaults, name)
            if choices == "bool":
                self.vars[name] = tk.BooleanVar(value=value)
                tk.Checkbutton(left, text=label, variable=self.vars[name]).grid(row=row, column=0, columnspan=2, sticky="w")
                continue
            tk.Label(left, text=label).grid(row=row, column=0, sticky="w", pady=1)
            self.vars[name] = tk.StringVar(value=str(value))
            if choices:
                ttk.Combobox(left, textvariable=self.vars[name], values=list(choices), state="readonly", width=30).grid(row=row, column=1, sticky="w", padx=6)
            else:
                tk.Entry(left, textvariable=self.vars[name], width=12).grid(row=row, column=1, sticky="w", padx=6)
        for row, (name, label) in enumerate(AUGMENTATION[kind]):
            tk.Label(right, text=label).grid(row=row, column=0, sticky="w", pady=1)
            self.vars[name] = tk.StringVar(value=str(getattr(defaults, name)))
            tk.Entry(right, textvariable=self.vars[name], width=10).grid(row=row, column=1, sticky="w", padx=6)

        buttons = tk.Frame(self)
        buttons.pack(fill="x", padx=8, pady=8)
        tk.Button(buttons, text="Start training", bg=GREEN, fg="white", width=16, command=lambda: view.start(kind)).pack(side="left")
        tk.Button(buttons, text="Reset to defaults", command=self.reset).pack(side="left", padx=8)
        if kind == "embedding":
            tk.Button(buttons, text="Crop photos with the live detector…", command=view.crop_photos).pack(side="left", padx=8)

    def _entry(self, parent, row, name, label, width=60):
        tk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=2)
        self.vars[name] = tk.StringVar()
        tk.Entry(parent, textvariable=self.vars[name], width=width).grid(row=row, column=1, sticky="w", pady=2)

    def _folder(self, parent, row, name, label):
        self._entry(parent, row, name, label, width=80)
        tk.Button(parent, text="Browse…", command=lambda: self._browse(name)).grid(row=row, column=2, sticky="w", padx=4)

    def _browse(self, name):
        path = filedialog.askdirectory(title="Choose a folder")
        if path:
            self.vars[name].set(path)

    def reset(self):
        defaults = CLASSES[self.kind](name="", train_dir="", test_dir="")
        for name, var in self.vars.items():
            if name in ("name", "train_dir", "test_dir", "compare"):
                continue
            var.set(getattr(defaults, name) if isinstance(var, tk.BooleanVar) else str(getattr(defaults, name)))

    def read(self):
        """(config, problems): problems are numbers that could not be read; validation comes after."""
        cls = CLASSES[self.kind]
        values, problems = {}, []
        labels = {n: l for n, l, _ in SETTINGS[self.kind]}
        labels.update(dict(AUGMENTATION[self.kind]))
        for f in fields(cls):
            if f.name == "compare_type_id":
                values[f.name] = self.view.type_id_of(self.vars["compare"].get())
                continue
            var = self.vars.get(f.name)
            if var is None:
                continue
            raw = var.get()
            kind = get_args(f.type)[0] if get_args(f.type) else f.type
            try:
                if kind is bool:
                    values[f.name] = bool(raw)
                elif kind is int:
                    values[f.name] = int(str(raw).strip())
                elif kind is float:
                    values[f.name] = float(str(raw).strip().replace(",", "."))
                else:
                    values[f.name] = str(raw).strip()
            except ValueError:
                problems.append(f"{labels.get(f.name, f.name)}: \"{raw}\" is not a number.")
        if problems:
            return None, problems
        return cls(**values), []


class ModelTrainingView(_AdminView):
    def __init__(self, parent, session, runs_root: Optional[str] = None, launcher=None):
        super().__init__(parent, session, "Model training")
        self.runs_root = runs_root or os.getenv("COFFER_RUNS_DIR") or DEFAULT_RUNS_DIR
        self.launcher = launcher or (lambda args, **kw: subprocess.Popen(args, **kw))
        self.processes = {}
        self.types = []
        self.selected = None
        self._poll_job = None

        bar = tk.Frame(self)
        bar.pack(fill="x", padx=10, pady=4)
        tk.Button(bar, text="Refresh", command=self.refresh, bg=BLUE, fg="white").pack(side="left")
        self.root_var = tk.StringVar(value=f"Runs folder: {self.runs_root}")
        tk.Label(bar, textvariable=self.root_var).pack(side="left", padx=10)
        tk.Button(bar, text="Change…", command=self.change_runs_root).pack(side="left")
        tk.Label(bar, text=device_text(), fg="gray").pack(side="left", padx=16)
        tk.Label(bar, textvariable=self.info_var, fg="gray").pack(side="left", padx=10)

        body = tk.Frame(self)
        body.pack(fill="both", expand=True, padx=10, pady=4)
        left = tk.Frame(body, width=560)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        frame, self.tree = _tree(left, ("name", "kind", "phase", "result", "started"),
                                 {"name": 150, "kind": 75, "phase": 75, "result": 150, "started": 100}, height=12)
        frame.pack(fill="x")
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        actions = tk.Frame(left)
        actions.pack(fill="x", pady=6)
        self.stop_button = tk.Button(actions, text="Stop", command=self.stop_selected, state="disabled")
        self.stop_button.pack(side="left")
        self.deploy_button = tk.Button(actions, text="Use for item type…", command=self.deploy_selected, state="disabled", bg=GREEN, fg="white")
        self.deploy_button.pack(side="left", padx=6)
        tk.Button(actions, text="Open run folder", command=self.open_folder).pack(side="left")

        self.status_var = tk.StringVar(value="Select a run to see its progress and report.")
        tk.Label(left, textvariable=self.status_var, anchor="w", justify="left", wraplength=540).pack(fill="x")
        self.progress = ttk.Progressbar(left, maximum=100)
        self.progress.pack(fill="x", pady=4)
        self.details = tk.Text(left, height=18, wrap="word", font=("Consolas", 9), state="disabled")
        self.details.pack(fill="both", expand=True)

        notebook = ttk.Notebook(body)
        notebook.pack(side="left", fill="both", expand=True, padx=(12, 0))
        self.forms = {}
        for kind, title in (("embedding", "Embedding model"), ("detection", "Detection model")):
            self.forms[kind] = SettingsForm(notebook, self, kind)
            notebook.add(self.forms[kind], text=title)

        self._schedule_poll()

    # ------------------------------------------------------------------ item types / settings

    def type_id_of(self, label: str):
        if not label or label == NO_TYPE:
            return None
        try:
            return int(label.split("·", 1)[0].strip())
        except ValueError:
            return None

    def _load_types(self):
        types = self.call(self.session.api().item_types)
        if types is not None:
            self.types = types
            values = [NO_TYPE] + [f"{t['id']} · {t['name']}" for t in types]
            for form in self.forms.values():
                form.compare_box.configure(values=values)

    def change_runs_root(self):
        path = filedialog.askdirectory(title="Folder for training runs")
        if not path:
            return
        self.runs_root = path
        self.root_var.set(f"Runs folder: {path}")
        try:
            from dotenv import set_key
            from reports.session import ENV_FILE
            set_key(str(ENV_FILE), "COFFER_RUNS_DIR", path)
        except Exception as e:  # remembering is a convenience
            self.info_var.set(f"Could not remember the folder: {e}")
        self.refresh()

    # ------------------------------------------------------------------ runs

    def start(self, kind: str):
        """Checks the settings, creates the run folder, fetches the live model to compare with, starts the worker.
        Returns the run folder, or None when the settings were refused."""
        cfg, problems = self.forms[kind].read()
        problems = problems or config.validate(cfg)
        if cfg is not None and kind == "detection" and cfg.base_model == LIVE_BASE and cfg.compare_type_id is None:
            problems.append("\"Live model\" as base model needs an item type to compare with.")
        if problems:
            messagebox.showerror("Coffer.Manager", "\n".join(problems), parent=self)
            return None

        run_dir = runs.create_run(self.runs_root, cfg)
        live = os.path.join(run_dir, f"live_{kind}.pt")
        if cfg.compare_type_id is not None:
            found = self.call(self.session.api().download_model, cfg.compare_type_id, kind, live)
            if not found:
                runs.log(run_dir, f"Item type {cfg.compare_type_id} has no live {kind} model to compare with.")
        if kind == "detection" and cfg.base_model == LIVE_BASE:
            if not os.path.exists(live):
                runs.write_progress(run_dir, "failed", message="The item type has no live detection model to start from.")
                self.refresh()
                return run_dir
            cfg.base_model = live
            config.save(cfg, os.path.join(run_dir, "config.json"))

        self.processes[run_dir] = self.launcher([sys.executable, "-m", "training.worker", run_dir], cwd=MANAGER_DIR)
        self.info_var.set(f"Started {os.path.basename(run_dir)}")
        self.refresh()
        self.select_run(run_dir)
        return run_dir

    def stop_selected(self):
        if not self.selected:
            return
        run_dir = self.selected
        open(os.path.join(run_dir, "STOP"), "w").close()
        self.info_var.set("Stopping… (the run ends after the current batch)")
        process = self.processes.get(run_dir)
        if process is not None:
            self.after(STOP_GRACE_MS, lambda: process.poll() is None and process.terminate())

    def poll_once(self):
        """Marks runs whose worker ended without finishing as stopped, then refreshes."""
        for run_dir, process in list(self.processes.items()):
            if process.poll() is None:
                continue
            if runs.read_progress(run_dir).get("phase") not in runs.FINISHED:
                runs.write_progress(run_dir, "stopped", message="The training process ended unexpectedly.")
                runs.log(run_dir, "The training process ended before finishing.")
            del self.processes[run_dir]
        self.refresh(load_types=False)

    def _schedule_poll(self):
        def tick():
            try:
                if self.processes or (self.selected and runs.read_progress(self.selected).get("phase") not in runs.FINISHED):
                    self.poll_once()
            finally:
                self._poll_job = self.after(POLL_MS, tick)
        self._poll_job = self.after(POLL_MS, tick)

    def destroy(self):
        if self._poll_job:
            self.after_cancel(self._poll_job)
            self._poll_job = None
        super().destroy()

    def refresh(self, load_types=True):
        if load_types:
            self._load_types()
        listed = runs.list_runs(self.runs_root)
        keep = self.selected
        self.tree.delete(*self.tree.get_children())
        for r in listed:
            started = r["created"][:8] + " " + r["created"][9:11] + ":" + r["created"][11:13] if len(r["created"]) >= 13 else r["created"]
            self.tree.insert("", "end", iid=r["path"], values=(r["name"], r["kind"], r["phase"], r["headline"], started))
        if keep and self.tree.exists(keep):
            self.tree.selection_set(keep)
        self._show_selected()

    def select_run(self, run_dir):
        if self.tree.exists(run_dir):
            self.tree.selection_set(run_dir)
            self.tree.see(run_dir)
        self.selected = run_dir
        self._show_selected()

    def _on_select(self, _event):
        sel = self.tree.selection()
        if sel:
            self.selected = sel[0]
            self._show_selected()

    def _show_selected(self):
        run_dir = self.selected
        if not run_dir or not os.path.isdir(run_dir):
            self.stop_button.configure(state="disabled")
            self.deploy_button.configure(state="disabled")
            return
        progress = runs.read_progress(run_dir)
        phase = progress.get("phase")
        epoch, epochs = progress.get("epoch") or 0, progress.get("epochs") or 0
        self.progress["value"] = 100 if phase == "done" else (100 * epoch / epochs if epochs else 0)
        text = f"{os.path.basename(run_dir)} — {phase}"
        if epochs:
            text += f", epoch {epoch}/{epochs}"
        if progress.get("message"):
            text += f"\n{progress['message']}"
        self.status_var.set(text)
        self.stop_button.configure(state="normal" if phase not in runs.FINISHED else "disabled")
        self.deploy_button.configure(state="normal" if self.can_deploy(run_dir) else "disabled")

        lines = []
        report_md = os.path.join(run_dir, "report.md")
        if os.path.exists(report_md):
            with open(report_md, encoding="utf-8") as f:
                lines.append(f.read())
        log_path = os.path.join(run_dir, "log.txt")
        if os.path.exists(log_path):
            with open(log_path, encoding="utf-8") as f:
                lines.append("Log (last lines):\n" + "".join(f.readlines()[-15:]))
        self.details.configure(state="normal")
        self.details.delete("1.0", "end")
        self.details.insert("1.0", "\n".join(lines))
        self.details.configure(state="disabled")

    def open_folder(self):
        if self.selected and os.path.isdir(self.selected):
            os.startfile(self.selected)

    # ------------------------------------------------------------------ deploy

    def can_deploy(self, run_dir: str) -> bool:
        cfg = runs.read_json(run_dir, "config.json") or {}
        kind = cfg.get("kind")
        return (runs.read_progress(run_dir).get("phase") == "done"
                and kind in ("embedding", "detection")
                and os.path.exists(os.path.join(run_dir, f"{kind}.pt")))

    def deploy_selected(self):
        if not self.selected or not self.can_deploy(self.selected):
            return
        self._load_types()
        dialog = _ChooseType(self, [f"{t['id']} · {t['name']}" for t in self.types])
        label = dialog.run()
        type_id = self.type_id_of(label) if label else None
        if type_id is not None:
            self.deploy(self.selected, type_id)

    def deploy(self, run_dir: str, type_id: int) -> bool:
        """Uploads the run's model to the item type (the backend checks the AI service can load it first)."""
        if not self.can_deploy(run_dir):
            return False
        kind = runs.read_json(run_dir, "config.json")["kind"]
        path = os.path.join(run_dir, f"{kind}.pt")
        name = next((t["name"] for t in self.types if t["id"] == type_id), f"#{type_id}")
        if not messagebox.askyesno("Coffer.Manager", f"Replace the live {kind} model of {name} with this run's model?\n\n"
                                                     "Photo checks of this item type use it from the next request.", parent=self):
            return False
        api = self.session.api()
        if kind == "embedding":
            import torch
            classes = torch.load(path, map_location="cpu", weights_only=True).get("classes") or []
            result = self.call(api.upload_models, type_id, embedding_path=path, class_count=max(2, len(classes)))
        else:
            result = self.call(api.upload_models, type_id, detection_path=path)
        if result is None:
            return False
        runs.log(run_dir, f"Deployed as the {kind} model of item type {type_id}.")
        self.info_var.set(f"The {kind} model of {name} is now this run's model.")
        self._show_selected()
        return True

    # ------------------------------------------------------------------ crop tool

    def crop_photos(self):
        """Crops every cap in a folder of photos (sub-folders kept) with an item type's live detector, to build
        embedding training or test data from raw photos."""
        self._load_types()
        label = _ChooseType(self, [f"{t['id']} · {t['name']}" for t in self.types], "Detector of item type").run()
        type_id = self.type_id_of(label) if label else None
        if type_id is None:
            return
        source = filedialog.askdirectory(title="Photos to crop (sub-folders are kept)")
        dest = source and filedialog.askdirectory(title="Where the crops go")
        if not source or not dest:
            return
        model_file = os.path.join(dest, f"_detector_{type_id}.pt")
        if not self.call(self.session.api().download_model, type_id, "detection", model_file):
            messagebox.showerror("Coffer.Manager", "That item type has no detection model.", parent=self)
            return
        self.info_var.set("Cropping…")

        def work():
            try:
                from training.crop import crop_folder
                count = crop_folder(model_file, source, dest)
                message = f"Saved {count} crops to {dest}"
            except Exception as e:
                message = f"Cropping failed: {e}"
            finally:
                if os.path.exists(model_file):
                    os.remove(model_file)
            self.after(0, lambda: self.info_var.set(message))

        threading.Thread(target=work, daemon=True).start()


class _ChooseType(tk.Toplevel):
    def __init__(self, parent, labels, title="Use for item type"):
        super().__init__(parent)
        self.title(title)
        self.transient(parent.winfo_toplevel())
        self.result = None
        tk.Label(self, text="Item type").pack(anchor="w", padx=10, pady=(10, 2))
        self.var = tk.StringVar(value=labels[0] if labels else "")
        ttk.Combobox(self, textvariable=self.var, values=labels, state="readonly", width=40).pack(padx=10)
        row = tk.Frame(self)
        row.pack(fill="x", padx=10, pady=10)
        tk.Button(row, text="Cancel", command=self.destroy).pack(side="right")
        tk.Button(row, text="OK", command=self._ok, bg=BLUE, fg="white").pack(side="right", padx=6)

    def _ok(self):
        self.result = self.var.get()
        self.destroy()

    def run(self):
        self.grab_set()
        self.wait_window()
        return self.result
