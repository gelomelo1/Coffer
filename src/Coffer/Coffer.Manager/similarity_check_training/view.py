import tkinter as tk
from tkinter import filedialog
from similarity_check_training.crop_images import crop_images
from similarity_check_training.training import train_similarity_model

class SimilarityCheckTrainingView(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent)

        # Instance variables for entries
        self.crop_tool_source_var = tk.StringVar()
        self.crop_tool_dest_var = tk.StringVar()
        self.crop_tool_model_var = tk.StringVar()
        self.crop_tool_recursive_var = tk.BooleanVar()

        self.similarity_trainer_source_var = tk.StringVar()
        self.similarity_trainer_dest_var = tk.StringVar()

        # Create a frame to hold all form widgets
        container = tk.Frame(self)
        container.pack(side="top", anchor="w", pady=20)  # center horizontally, top vertically

        # Crop tool left
        crop_frame = tk.Frame(container, padx=20)
        crop_frame.pack(side="left", anchor="n")

        # === Image cropper Title ===
        tk.Label(
            crop_frame,
            text="YOLOv8 Image Cropping Tool",
            font=("Helvetica", 16, "bold"),
            fg="#2E86C1"
        ).pack(pady=(0, 15))

        # Crop tool source directory
        tk.Label(crop_frame, text="Source directory:").pack(anchor="center", pady=(10,0))
        tk.Entry(crop_frame, textvariable=self.crop_tool_source_var, width=60).pack(pady=5)
        tk.Button(crop_frame, text="Browse", command=self.select_crop_tool_source).pack(pady=5)

        # Crop tool destination directory
        tk.Label(crop_frame, text="Destination directory:").pack(anchor="center", pady=(10,0))
        tk.Entry(crop_frame, textvariable=self.crop_tool_dest_var, width=60).pack(pady=5)
        tk.Button(crop_frame, text="Browse", command=self.select_crop_tool_destination).pack(pady=5)

        # YOLOv8 model
        tk.Label(crop_frame, text="YOLOv8 model (.pt):").pack(anchor="center", pady=(10,0))
        tk.Entry(crop_frame, textvariable=self.crop_tool_model_var, width=60).pack(pady=5)
        tk.Button(crop_frame, text="Browse", command=self.select_crop_tool_model).pack(pady=5)

        # Crop tool recursive
        tk.Label(crop_frame, text="Recursive").pack(anchor="center", pady=(10,0))
        tk.Checkbutton(crop_frame, variable=self.crop_tool_recursive_var).pack(pady=5)

        # Run crop tool button
        tk.Button(crop_frame, text="Crop images", command=self.handle_crop_images, bg="green", fg="white").pack(pady=20)

        # Train frame right
        train_frame = tk.Frame(container, padx=30)
        train_frame.pack(side="left", anchor="n")

        # === Similarity Check Trainer Title ===
        tk.Label(
            train_frame,
            text="Tripple Loss and Transfer Learning Similarity Training",
            font=("Helvetica", 16, "bold"),
            fg="#2E86C1"
        ).pack(pady=(0, 15))

        # Similarity trainer source directory
        tk.Label(train_frame, text="Source directory:").pack(anchor="center", pady=(10,0))
        tk.Entry(train_frame, textvariable=self.similarity_trainer_source_var, width=60).pack(pady=5)
        tk.Button(train_frame, text="Browse", command=self.select_similarity_trainer_soruce).pack(pady=5)

        # Similarity trainer destionation directory
        tk.Label(train_frame, text="Destination directory:").pack(anchor="center", pady=(10,0))
        tk.Entry(train_frame, textvariable=self.similarity_trainer_dest_var, width=60).pack(pady=5)
        tk.Button(train_frame, text="Browse", command=self.select_similarity_trainer_destination).pack(pady=5)

        # Run similarity trainer button
        tk.Button(train_frame, text="Train model", command=self.handle_train_similarity_model, bg="green", fg="white").pack(pady=20)

    # Crop tool browse methods
    def select_crop_tool_source(self):
        path = filedialog.askdirectory(title="Select Source Directory")
        if path:
            self.crop_tool_source_var.set(path)

    def select_crop_tool_destination(self):
        path = filedialog.askdirectory(title="Select Destination Directory")
        if path:
            self.crop_tool_dest_var.set(path)

    def select_crop_tool_model(self):
        path = filedialog.askopenfilename(
            title="Select YOLOv8 Model (.pt)",
            filetypes=[("YOLOv8 Model", "*.pt")]
        )
        if path:
            self.crop_tool_model_var.set(path)

    # Crop tool start method
    def handle_crop_images(self):
        source = self.crop_tool_source_var.get()
        dest = self.crop_tool_dest_var.get()
        model_path = self.crop_tool_model_var()
        recursive = self.crop_tool_recursive_var()
        crop_images(source, dest, model_path, recursive)
        self.crop_tool_source_var.set("")
        self.crop_tool_dest_var.set("")
        self.crop_tool_model_var("")
        self.crop_tool_recursive_var(False)

    # Similarity trainer tool browse methods
    def select_similarity_trainer_soruce(self):
        path = filedialog.askdirectory(title="Select Source Directory")
        if path:
            self.similarity_trainer_source_var.set(path)

    def select_similarity_trainer_destination(self):
        path = filedialog.askdirectory(title="Select Destination Directory")
        if path:
            self.similarity_trainer_dest_var.set(path)

    # Similarity trainer start method
    def handle_train_similarity_model(self):
        source = self.similarity_trainer_source_var.get()
        dest = self.similarity_trainer_dest_var.get()
        train_similarity_model(source, dest, 30)
        self.similarity_trainer_source_var.set("")
        self.similarity_trainer_dest_var.set("")
