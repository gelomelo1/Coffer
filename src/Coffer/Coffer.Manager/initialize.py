import tkinter as tk
from tkinter import ttk
from similarity_check_training.view import SimilarityCheckTrainingView

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Multi-View Tkinter App")
        self.geometry("1600x800")
        self.resizable(False, False)

        # Dropdown to select view
        self.view_selector = ttk.Combobox(self, values=["Similarity Check Training"])
        self.view_selector.current(0)
        self.view_selector.pack(anchor="nw", padx=10, pady=10)
        self.view_selector.bind("<<ComboboxSelected>>", self.switch_view)

        # Container for views
        self.container = tk.Frame(self)
        self.container.pack(expand=True)  # allow container to expand
        self.container.pack_propagate(False)  # prevent shrinking to children

        # Initialize views
        self.views = {}
        for V, name in zip((SimilarityCheckTrainingView,), ("Similarity Check Training",)):
            frame = V(self.container)
            self.views[name] = frame
            frame.grid(row=0, column=0, sticky="nsew")

        # Show initial view
        self.show_view("Similarity Check Training")

    def show_view(self, name):
        frame = self.views[name]
        frame.tkraise()

    def switch_view(self, event):
        selected_view = self.view_selector.get()
        self.show_view(selected_view)