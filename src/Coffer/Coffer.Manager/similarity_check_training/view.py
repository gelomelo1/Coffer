import tkinter as tk
from tkinter import messagebox, filedialog
from similarity_check_training.list_collection import list_collection
from similarity_check_training.insert_to_collection import insert_to_collection
from similarity_check_training.create_vector_database import create_vector_database
from similarity_check_training.crop_images import crop_images
from similarity_check_training.training_best_try import train_similarity_model

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
        self.similarity_model_name_var = tk.StringVar()

        self.vector_database_dest_var = tk.StringVar()
        self.vector_database_name_var  = tk.StringVar()

        self.vector_database_embedding_var  = tk.StringVar()
        self.vector_database_id_var = tk.StringVar()
        self.vector_database_metadata_var = tk.StringVar()

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

        # Similarity trainer model name
        tk.Label(train_frame, text="Model name:").pack(anchor="center", pady=(10,0))
        tk.Entry(train_frame, textvariable=self.similarity_model_name_var, width=60).pack(pady=5)

        # Run similarity trainer button
        tk.Button(train_frame, text="Train model", command=self.handle_train_similarity_model, bg="green", fg="white").pack(pady=20)

        # Vector database frame right
        vector_database_frame = tk.Frame(container, padx=30)
        vector_database_frame.pack(side="left", anchor="n")

        # === Vector database Title ===
        tk.Label(
            vector_database_frame,
            text="Vector database",
            font=("Helvetica", 16, "bold"),
            fg="#2E86C1"
        ).pack(pady=(0, 15))

        # Vector database destination directory
        tk.Label(vector_database_frame, text="Destination Directory:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_dest_var, width=60).pack(pady=5)
        tk.Button(vector_database_frame, text="Browse", command=self.select_vector_database_destination).pack(pady=5)

        # Vector database name
        tk.Label(vector_database_frame, text="Database name:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_name_var, width=60).pack(pady=5)

        # Create vector database button
        tk.Button(vector_database_frame, text="Create vector database", command=self.handle_create_vector_database, bg="green", fg="white").pack(pady=20)


        tk.Label(vector_database_frame, text="Insert to collection:").pack(anchor="center", pady=(10,0))
        # Vector database destination directory
        tk.Label(vector_database_frame, text="Vector Database Destination Directory:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_dest_var, width=60).pack(pady=5)
        tk.Button(vector_database_frame, text="Browse", command=self.select_vector_database_destination).pack(pady=5)

        # Embedding file
        tk.Label(vector_database_frame, text="Embedding File:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_embedding_var, width=60).pack(pady=5)
        tk.Button(vector_database_frame, text="Browse", command=self.select_vector_database_embedding).pack(pady=5)

        # Collection
        tk.Label(vector_database_frame, text="Collection name:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_name_var, width=60).pack(pady=5)

        # Id
        tk.Label(vector_database_frame, text="Id:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_id_var, width=60).pack(pady=5)

        # Metadatas
        tk.Label(vector_database_frame, text="Metadata:").pack(anchor="center", pady=(10,0))
        tk.Entry(vector_database_frame, textvariable=self.vector_database_metadata_var, width=60).pack(pady=5)

        # Create a frame to hold the buttons horizontally
        button_frame = tk.Frame(vector_database_frame)
        button_frame.pack(pady=20)

        # Insert to collection button
        tk.Button(button_frame, text="Insert to collection", command=self.handle_insert_to_collection, bg="green", fg="white").pack(side=tk.LEFT, padx=10)

        # List collection button
        tk.Button(button_frame, text="List collection", command=self.handle_list_collection, bg="green", fg="white").pack(side=tk.LEFT, padx=10)

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
        model_path = self.crop_tool_model_var.get()
        recursive = self.crop_tool_recursive_var.get()
        try:
            crop_images(source, dest, model_path, recursive)
            messagebox.showinfo("Done", f"All detected objects cropped and saved to:\n{dest}")
        except Exception as e:
            messagebox.showerror("Error", str(e))
        self.crop_tool_source_var.set("")
        self.crop_tool_dest_var.set("")
        self.crop_tool_model_var.set("")
        self.crop_tool_recursive_var.set(False)

    # Similarity trainer tool browse methods
    def select_similarity_trainer_soruce(self):
        path = filedialog.askdirectory(title="Select Source Directory")
        if path:
            self.similarity_trainer_source_var.set(path)

    def select_similarity_trainer_destination(self):
        path = filedialog.askdirectory(title="Select Destination Directory")
        if path:
            self.similarity_trainer_dest_var.set(path)

    def select_vector_database_destination(self):
        path = filedialog.askdirectory(title="Select Destination Directory")
        if path:
            self.vector_database_dest_var.set(path)

    def select_vector_database_embedding(self):
        path = filedialog.askopenfilename(title="Select Embedding file")
        if path:
            self.vector_database_embedding_var.set(path)

    # Similarity trainer start method
    def handle_train_similarity_model(self):
        source = self.similarity_trainer_source_var.get()
        dest = self.similarity_trainer_dest_var.get()
        name = self.similarity_model_name_var.get()
        train_similarity_model(source, dest)
        messagebox.showinfo("Done", f"✅ Training complete. Model {name} saved to: {dest}")
        self.similarity_trainer_source_var.set("")
        self.similarity_trainer_dest_var.set("")
        self.similarity_model_name_var.set("")

    def handle_create_vector_database(self):
        dest = self.vector_database_dest_var.get()
        name = self.vector_database_name_var.get()
        create_vector_database(dest, name)
        messagebox.showinfo("Done", f"✅ Collection {name} created or loaded at {dest}")
        self.vector_database_dest_var.set("")
        self.vector_database_name_var.set("")

    def handle_insert_to_collection(self):
        dest = self.vector_database_dest_var.get()
        name = self.vector_database_name_var.get()
        embedding_file = self.vector_database_embedding_var.get()
        id = self.vector_database_id_var.get()
        metadata = self.vector_database_metadata_var.get()
        insert_to_collection(dest, name, embedding_file, id, metadata)
        messagebox.showinfo("Done", f"Value inserted to {name}")
        self.vector_database_dest_var.set("")
        self.vector_database_name_var.set("")
        self.vector_database_embedding_var.set("")
        self.vector_database_id_var.set("")
        self.vector_database_metadata_var.set("")

    def handle_list_collection(self):
        dest = self.vector_database_dest_var.get()
        name = self.vector_database_name_var.get()
        list_collection(dest, name)
        self.vector_database_dest_var.set("")
        self.vector_database_name_var.set("")