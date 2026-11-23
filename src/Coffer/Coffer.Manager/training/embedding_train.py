"""Embedding training: metric learning on cap variants with identity-preserving augmentation.

Validation uses classes held out from training (the production case: caps the model has not seen), and picks the
best epoch by their Recall@1. No flips (mirrored text is not the same cap) and almost no hue shift (colour is part
of a cap's identity). The LR schedule is stepped once per epoch.
"""
import copy
import csv
import os
import random

import numpy as np
import torch
from PIL import Image
from pytorch_metric_learning import losses, miners
from pytorch_metric_learning.samplers import MPerClassSampler
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from training import runs
from training.coffer_models import IMAGENET_MEAN, IMAGENET_STD, LEGACY_THRESHOLDS, EmbeddingNet, eval_transform, save_embedding_model
from training.datasets import split_classes
from training.metrics import retrieval_metrics


class StopRequested(Exception):
    """The admin pressed Stop (the STOP file exists in the run folder)."""


class _Images(Dataset):
    def __init__(self, items, transform):
        self.items = items  # [(path, label index)]
        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        with Image.open(path) as img:
            return self.transform(img.convert("RGB")), label


def build_train_transform(cfg):
    fill = tuple(int(255 * m) for m in IMAGENET_MEAN)
    steps = [
        transforms.Resize(int(cfg.image_size * 1.15)),
        transforms.RandomRotation(180, fill=fill),  # caps are round: any rotation is a real photo
    ]
    if cfg.perspective > 0:
        steps.append(transforms.RandomPerspective(distortion_scale=cfg.perspective, p=0.5, fill=fill))
    steps += [
        transforms.RandomResizedCrop(cfg.image_size, scale=(0.6, 1.0), ratio=(0.9, 1.1)),
        transforms.ColorJitter(brightness=cfg.brightness, contrast=cfg.contrast, saturation=cfg.saturation, hue=cfg.hue),
        transforms.RandomApply([transforms.GaussianBlur(5, sigma=(0.1, 1.5))], p=cfg.blur_p),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        transforms.RandomErasing(p=cfg.erasing_p, scale=(0.02, 0.15), ratio=(0.5, 2.0)),
    ]
    return transforms.Compose(steps)


def is_better(val: dict, best) -> bool:
    """Best epoch by validation Recall@1, ties broken by MAP@R: with few validation caps Recall@1 is soon 1.0
    while the ranking (and the gap between same and different caps) still improves."""
    if best is None:
        return True
    return (round(val["r1"], 6), round(val["map_at_r"], 6)) > (round(best["r1"], 6), round(best["map_at_r"], 6))


def _frozen_modules(net, stages: int):
    b = net.backbone
    groups = [[b.conv1, b.bn1], [b.layer1], [b.layer2], [b.layer3]]
    return [m for group in groups[:stages] for m in group]


def _seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def embed_paths(net, paths, image_size, device, batch=32) -> np.ndarray:
    transform = eval_transform(image_size)
    net.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(paths), batch):
            tensors = []
            for p in paths[i:i + batch]:
                with Image.open(p) as img:
                    tensors.append(transform(img.convert("RGB")))
            out.append(net(torch.stack(tensors).to(device)).cpu().numpy())
    return np.concatenate(out) if out else np.zeros((0, 1), np.float32)


def train_embedding(run_dir: str, cfg, data, device: str, stop_file: str) -> str:
    _seed(cfg.seed)
    train_classes, val_classes = split_classes(list(data.train), cfg.val_fraction, cfg.seed)
    index = {c: i for i, c in enumerate(train_classes)}
    items = [(p, index[c]) for c in train_classes for p in data.train[c]]
    val_paths = [p for c in val_classes for p in data.train[c]]
    val_labels = [c for c in val_classes for _ in data.train[c]]
    runs.log(run_dir, f"Training classes: {len(train_classes)} ({len(items)} images); validation classes: {len(val_classes)} ({len(val_paths)} images).")

    per_batch = min(cfg.classes_per_batch, len(train_classes))
    if per_batch < cfg.classes_per_batch:
        runs.log(run_dir, f"Only {len(train_classes)} training classes: {per_batch} classes per batch.")
    batch_size = per_batch * cfg.images_per_class
    sampler = MPerClassSampler([label for _, label in items], m=cfg.images_per_class, batch_size=batch_size,
                               length_before_new_iter=max(len(items), batch_size))
    loader = DataLoader(_Images(items, build_train_transform(cfg)), batch_size=batch_size, sampler=sampler, num_workers=0)

    net = EmbeddingNet(cfg.backbone, cfg.embedding_dim, pretrained=cfg.pretrained).to(device)
    frozen = _frozen_modules(net, cfg.frozen_stages)
    for module in frozen:
        for p in module.parameters():
            p.requires_grad = False

    triplet = losses.TripletMarginLoss(margin=0.2)
    miner = miners.BatchHardMiner()
    arcface = None
    if cfg.loss == "subcenter_arcface":
        arcface = losses.SubCenterArcFaceLoss(num_classes=len(train_classes), embedding_size=cfg.embedding_dim, sub_centers=3).to(device)

    groups = [
        {"params": [p for p in net.backbone.parameters() if p.requires_grad], "lr": cfg.lr * 0.1},
        {"params": list(net.head.parameters()), "lr": cfg.lr},
    ]
    if arcface is not None:
        groups.append({"params": list(arcface.parameters()), "lr": cfg.lr})
    optimizer = torch.optim.AdamW(groups, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=cfg.epochs, eta_min=cfg.lr * 0.01)

    metrics_path = os.path.join(run_dir, "metrics.csv")
    with open(metrics_path, "w", newline="") as f:
        csv.writer(f).writerow(["epoch", "loss", "val_r1", "val_map_at_r", "lr"])

    best_val, best_state, best_epoch, since_best = None, None, 0, 0
    for epoch in range(1, cfg.epochs + 1):
        net.train()
        for module in frozen:
            module.eval()
        total, batches = 0.0, 0
        for images, labels in loader:
            if os.path.exists(stop_file):
                raise StopRequested()
            images, labels = images.to(device), labels.to(device)
            embeddings = net(images)
            loss = triplet(embeddings, labels, miner(embeddings, labels))
            if arcface is not None:
                loss = arcface(embeddings, labels) + 0.5 * loss
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += float(loss.item())
            batches += 1
        lr = optimizer.param_groups[1]["lr"]
        scheduler.step()

        val = retrieval_metrics(embed_paths(net, val_paths, cfg.image_size, device), val_labels)
        with open(metrics_path, "a", newline="") as f:
            csv.writer(f).writerow([epoch, round(total / max(1, batches), 5), round(val["r1"], 4), round(val["map_at_r"], 4), lr])
        if is_better(val, best_val):
            best_val, best_state, best_epoch, since_best = val, copy.deepcopy(net.state_dict()), epoch, 0
        else:
            since_best += 1
        runs.write_progress(run_dir, "training", epoch=epoch, epochs=cfg.epochs, loss=round(total / max(1, batches), 4),
                            val_r1=round(val["r1"], 4), val_map_at_r=round(val["map_at_r"], 4),
                            best_val_r1=round(best_val["r1"], 4), best_epoch=best_epoch)
        runs.log(run_dir, f"Epoch {epoch}/{cfg.epochs}: loss {total / max(1, batches):.4f}, "
                          f"validation R@1 {val['r1']:.3f}, MAP@R {val['map_at_r']:.3f}")
        if since_best >= cfg.patience:
            runs.log(run_dir, f"No improvement for {cfg.patience} epochs: stopping early (best epoch {best_epoch}).")
            break

    net.load_state_dict(best_state)
    path = os.path.join(run_dir, "embedding.pt")
    save_embedding_model(path, net, backbone=cfg.backbone, embedding_dim=cfg.embedding_dim, image_size=cfg.image_size,
                         thresholds=LEGACY_THRESHOLDS, classes=train_classes, run_id=os.path.basename(run_dir))
    return path
