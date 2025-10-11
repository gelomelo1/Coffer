import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
import torch.nn.functional as F
from torch.optim.lr_scheduler import ReduceLROnPlateau
from pytorch_metric_learning import miners, losses
from pytorch_metric_learning.samplers import MPerClassSampler
from collections import Counter
import os


class ResNetEmbeddingWithClassifier(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        base = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)

        # Freeze most layers for transfer learning
        for name, param in base.named_parameters():
            if "layer1" in name or "layer2" in name:
                param.requires_grad = False

        num_feats = base.fc.in_features
        base.fc = nn.Identity()  # remove final classification head
        self.backbone = base

        # Embedding head
        self.embedding_head = nn.Sequential(
            nn.Linear(num_feats, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, 256)
        )

        # Classification head
        self.classifier = nn.Linear(256, num_classes)

    def forward(self, x):
        feats = self.backbone(x)
        embedding = F.normalize(self.embedding_head(feats), p=2, dim=1)
        logits = self.classifier(embedding)
        return embedding, logits


import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
import numpy as np
import torch
import torch.nn.functional as F

def collect_embeddings(model, dataloader, max_batches=10):
    model.eval()
    all_embeddings = []
    all_labels = []
    device = next(model.parameters()).device

    with torch.no_grad():
        for i, (imgs, labels) in enumerate(dataloader):
            if i >= max_batches:
                break
            imgs = imgs.to(device)
            embeddings, _ = model(imgs)
            embeddings = F.normalize(embeddings, p=2, dim=1)
            all_embeddings.append(embeddings.cpu())
            all_labels.append(labels.cpu())

    embeddings = torch.cat(all_embeddings).numpy()
    labels = torch.cat(all_labels).numpy()
    return embeddings, labels


def visualize_embeddings(model, dataloader):
    print("📊 Collecting embeddings for visualization...")
    embeddings, labels = collect_embeddings(model, dataloader)

    print("🌀 Running t-SNE...")
    tsne = TSNE(n_components=2, learning_rate='auto', init='pca').fit_transform(embeddings)

    plt.figure(figsize=(10, 8))
    scatter = plt.scatter(tsne[:, 0], tsne[:, 1], c=labels, cmap='tab20', s=10, alpha=0.7)
    plt.colorbar(scatter, label='Class ID')
    plt.title("t-SNE visualization of learned embeddings")
    plt.show()


def train_similarity_model(input_dir: str, output_dir: str, name: str, epochs: int = 20, batch_size: int = 32):
    """
    Trains a ResNet50 model for visual similarity with combined
    classification + metric learning (Triplet Loss + CrossEntropy).

    Args:
        input_dir (str): Dataset path structured as ImageFolder (class folders)
        output_dir (str): Path to save model
        epochs (int): Number of training epochs
        batch_size (int): Training batch size
    """

    os.makedirs(output_dir, exist_ok=True)

    # --- Data augmentation ---
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomRotation(180),
        transforms.ColorJitter(0.4, 0.4, 0.4, 0.2),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomPerspective(distortion_scale=0.1, p=0.5),
        transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.0))], p=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # --- Dataset ---
    dataset = datasets.ImageFolder(root=input_dir, transform=train_transform)
    num_classes = len(dataset.classes)
    labels = [label for _, label in dataset.imgs]
    sampler = MPerClassSampler(labels, m=4, batch_size=batch_size, length_before_new_iter=len(dataset))
    dataloader = DataLoader(dataset, batch_size=batch_size, sampler=sampler, num_workers=2)

    # --- Check distribution ---
    for imgs, lbls in dataloader:
        counts = Counter(lbls.tolist())
        print(f"Sample class distribution in first batch: {counts}")
        break

    # --- Model ---
    model = ResNetEmbeddingWithClassifier(num_classes=num_classes)

    # --- Losses ---
    ce_loss = nn.CrossEntropyLoss()
    triplet_loss = losses.TripletMarginLoss(margin=0.2)
    miner = miners.TripletMarginMiner(margin=0.2, type_of_triplets="semi-hard")

    # --- Optimizer ---
    optimizer = torch.optim.AdamW([
        {"params": model.backbone.layer1.parameters(), "lr": 1e-5},
        {"params": model.backbone.layer2.parameters(), "lr": 1e-5},
        {"params": model.backbone.layer3.parameters(), "lr": 1e-4},
        {"params": model.backbone.layer4.parameters(), "lr": 3e-4},
        {"params": model.embedding_head.parameters(), "lr": 1e-3},
        {"params": model.classifier.parameters(), "lr": 1e-3},
    ], weight_decay=1e-4)

    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    # --- Device ---
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # --- Training ---
    print(f"🚀 Starting training on {device} for {epochs} epochs...")

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0

        for imgs, labels in dataloader:
            imgs, labels = imgs.to(device), labels.to(device)

            embeddings, logits = model(imgs)

            hard_triplets = miner(embeddings, labels)
            metric_loss = triplet_loss(embeddings, labels, hard_triplets)
            class_loss = ce_loss(logits, labels)

            # Combine losses (you can tune 0.5 weight)
            loss = 0.3 * class_loss + 0.7 * metric_loss

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        avg_loss = total_loss / len(dataloader)
        print(f"📘 Epoch [{epoch+1}/{epochs}] - Total Loss: {avg_loss:.4f}")

        scheduler.step(avg_loss)

    # --- Save model ---
    model_path = os.path.join(output_dir, name)
    torch.save(model.state_dict(), model_path)
    print(f"✅ Training complete. Model saved to: {model_path}")

    visualize_embeddings(model, dataloader)

    return model