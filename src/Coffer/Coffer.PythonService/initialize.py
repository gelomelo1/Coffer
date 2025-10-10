from fastapi import FastAPI
from contextlib import asynccontextmanager
from ultralytics import YOLO
import torch
from torchvision import models
from torch import nn
import os
from config import CNN_MODEL, DEVICE, UPLOAD_DIR, YOLO_MODEL

# --- Lifespan handler ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔹 Making folders, initializing YOLOv8 and CLIP models...")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    # Load models once during startup
    app.state.yolo_model = YOLO(YOLO_MODEL)

    # 1️⃣ Recreate the architecture exactly like during training
    resnet = models.resnet50(weights=None)
    num_feats = resnet.fc.in_features
    resnet.fc = nn.Sequential(
        nn.Linear(num_feats, 256),
        nn.ReLU(),
        nn.Dropout(0.4),
        nn.Linear(256, 128)  # embedding size
    )

    # 2️⃣ Load the saved weights
    state_dict = torch.load(CNN_MODEL, map_location=DEVICE)
    resnet.load_state_dict(state_dict)

    # 3️⃣ Move to device and set eval mode
    resnet.to(DEVICE)
    resnet.eval()

    app.state.cnn_model = resnet

    print("✅ Models initialized successfully.")
    yield  # <-- the app runs while inside this context
    print("🧹 Shutting down... (cleanup if needed)")