import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
import torch.nn.functional as F
from pytorch_metric_learning import miners, losses
import os

def train_similarity_model(input_dir: str, output_dir: str, epochs: int = 10, batch_size: int = 8):
    """
    Trains a CNN (ResNet50) for visual similarity using Triplet Loss.

    Args:
        input_dir (str): Path to dataset folder structured as ImageFolder (e.g., dataset/class1/imgs).
        output_dir (str): Path to save trained model and logs.
        epochs (int): Number of training epochs.
        batch_size (int): Training batch size.
    """

    # --- Ensure output directory exists ---
    os.makedirs(output_dir, exist_ok=True)

    # --- Data augmentation for robustness ---
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomRotation(45),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.15),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomPerspective(distortion_scale=0.2, p=0.5),
        transforms.RandomApply([transforms.GaussianBlur(3)], p=0.3),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # --- Load dataset ---
    dataset = datasets.ImageFolder(root=input_dir, transform=train_transform)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=2)

    # --- Model setup ---
    resnet = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
    for param in resnet.parameters():
        param.requires_grad = False
    for param in resnet.layer4.parameters():  # last block
        param.requires_grad = True

    num_feats = resnet.fc.in_features
    resnet.fc = nn.Sequential(
        nn.Linear(num_feats, 256),
        nn.ReLU(),
        nn.Dropout(0.4),
        nn.Linear(256, 128)  # Output embedding size
    )
    model = resnet

    # --- Metric learning setup ---
    loss_func = losses.TripletMarginLoss(margin=0.3)
    miner = miners.TripletMarginMiner(margin=0.4, type_of_triplets="semihard")
    optimizer = torch.optim.AdamW([
    {"params": resnet.layer4.parameters(), "lr": 3e-4},
    {"params": resnet.fc.parameters(), "lr": 1e-3}
    ], weight_decay=1e-4)

    # --- Device ---
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # --- Training loop ---
    print(f"🚀 Starting training on {device} for {epochs} epochs...")

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0

        for imgs, labels in dataloader:
            imgs, labels = imgs.to(device), labels.to(device)

            embeddings = F.normalize(model(imgs), p=2, dim=1)  # ✅ Normalized embeddings

            hard_triplets = miner(embeddings, labels)
            loss = loss_func(embeddings, labels, hard_triplets)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        avg_loss = total_loss / len(dataloader)
        print(f"📘 Epoch [{epoch+1}/{epochs}] - Loss: {avg_loss:.4f}")

    # --- Save trained model ---
    model_path = os.path.join(output_dir, "cap_similarity_model.pt")
    torch.save(model.state_dict(), model_path)
    print(f"✅ Training complete. Model saved to: {model_path}")