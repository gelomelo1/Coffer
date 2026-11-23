"""Read-only evaluation of the deployed Coffer models (inference only; nothing is trained or written outside stdout).

Run with the Coffer.Manager venv:  python ai_eval.py
"""
import os, re, sys, json, statistics
import numpy as np
import cv2
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import models, transforms

sys.path.insert(0, r"E:\Homework\Programming\AI\Coffer\src\Coffer\Coffer.PythonService")
from image_to_cnn_embedding import ResNetEmbeddingWithClassifier  # the production class
from ultralytics import YOLO

MODELS = r"E:\Homework\Programming\AI\Coffer\src\Coffer\Coffer.PythonService\models"
DATA = r"E:\Homework\Programming\AI\szakdolgozat\training\ObjectSimilarity"
torch.set_grad_enabled(False)
pre = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(),
                          transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

# ---------------------------------------------------------------- models
tuned = ResNetEmbeddingWithClassifier(60)
tuned.load_state_dict(torch.load(os.path.join(MODELS, "1_similarity_60.pt"), map_location="cpu"))
tuned.eval()
r18 = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1); r18.fc = torch.nn.Identity(); r18.eval()
r50 = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1); r50.fc = torch.nn.Identity(); r50.eval()
EMBEDDERS = {"deployed (fine-tuned R18, 256-d)": lambda x: tuned(x)[0],
             "ImageNet R18 (no fine-tuning, 512-d)": r18,
             "ImageNet R50 (no fine-tuning, 2048-d)": r50}


def embed(fn, rgb_arrays, bs=32):
    out = []
    for i in range(0, len(rgb_arrays), bs):
        x = torch.stack([pre(Image.fromarray(a)) for a in rgb_arrays[i:i + bs]])
        out.append(F.normalize(fn(x), dim=1))
    return torch.cat(out).numpy()


def load_rgb(path):
    return np.array(Image.open(path).convert("RGB"))


# ---------------------------------------------------------------- 1. retrieval on the training crops
classes = sorted(os.listdir(os.path.join(DATA, "Processed")))
files, labels = [], []
for ci, c in enumerate(classes):
    for f in sorted(os.listdir(os.path.join(DATA, "Processed", c))):
        files.append(os.path.join(DATA, "Processed", c, f)); labels.append(ci)
labels = np.array(labels)
phone = np.array([int(c[3:]) <= 35 for c in classes])[labels]
imgs = [load_rgb(f) for f in files]


def retrieval(E, mask=None):
    S = E @ E.T
    np.fill_diagonal(S, -9)
    idx = np.where(mask)[0] if mask is not None else np.arange(len(E))
    r1 = r5 = 0
    ap = []
    for q in idx:
        order = np.argsort(-S[q])
        rel = labels[order] == labels[q]
        r1 += rel[0]; r5 += rel[:5].any()
        R = rel.sum() - 0  # positives excluding self (self score is -9, last)
        hits = np.cumsum(rel[:R]); ap.append((hits / np.arange(1, R + 1) * rel[:R]).sum() / R)
    same = labels[:, None] == labels[None, :]
    eye = np.eye(len(E), dtype=bool)
    sub = np.zeros_like(same); sub[np.ix_(idx, np.arange(len(E)))] = True
    pos = (S[same & ~eye & sub]); neg = S[~same & sub]
    return dict(n=len(idx), R1=r1 / len(idx), R5=r5 / len(idx), mAPatR=float(np.mean(ap)), pos=pos, neg=neg)


def pct(a, ps=(5, 50, 95)):
    return " / ".join(f"{np.percentile(a, p):.3f}" for p in ps)


print("=" * 100)
print("1. LEAVE-ONE-OUT RETRIEVAL ON THE 321 TRAINING CROPS (the deployed model has SEEN these; baselines have not)")
for name, fn in EMBEDDERS.items():
    E = embed(fn, imgs)
    for label, m in (("all 60 classes", None), ("phone classes 01-35", phone), ("scraped classes 36-60", ~phone)):
        r = retrieval(E, m)
        print(f"{name:40s} {label:24s} n={r['n']:3d}  R@1={r['R1']:.3f}  R@5={r['R5']:.3f}  mAP@R={r['mAPatR']:.3f}")
    r = retrieval(E)
    print(f"    cosine positives p5/p50/p95 = {pct(r['pos'])}   negatives p5/p50/p95 = {pct(r['neg'])}  max neg = {r['neg'].max():.3f}")
    if name.startswith("deployed"):
        for th, what in ((0.975, "'found' (service 0.95 = cos 0.975)"), (0.925, "'similar' (service 0.85 = cos 0.925)")):
            print(f"    cos >= {th}: positives {np.mean(r['pos'] >= th):.1%}  negatives {np.mean(r['neg'] >= th):.2%}   <- {what}")
        def f1_at(t):
            tp = np.sum(r['pos'] >= t); fp = np.sum(r['neg'] >= t)
            rec = tp / len(r['pos']); prec = tp / max(1, tp + fp)
            return (2 * prec * rec / max(1e-9, prec + rec), t)
        best_f1 = max((f1_at(t) for t in np.arange(0.3, 1.0, 0.01)), key=lambda x: x[0])
        print(f"    pair-level best-F1 threshold on training data: cos {best_f1[1]:.2f} (F1 {best_f1[0]:.3f})")
        # where do phone queries' wrong top-1 neighbours come from?
        S = E @ E.T; np.fill_diagonal(S, -9)
        wrong = [(phone[q], phone[np.argmax(S[q])]) for q in range(len(E)) if labels[np.argmax(S[q])] != labels[q]]
        print(f"    wrong top-1s: {len(wrong)}; phone->scraped {sum(a and not b for a, b in wrong)}, scraped->phone {sum(b and not a for a, b in wrong)}")
        # flip invariance: a mirrored cap (mirrored text/logo) looks the same to the model
        flips = embed(fn, [np.ascontiguousarray(a[:, ::-1]) for a in imgs[:60]])
        print(f"    cosine(image, its mirror image) median = {np.median(np.sum(flips * E[:60], 1)):.3f}  (mirrored logos look identical)")
    TSNE_NOTE = None

# ---------------------------------------------------------------- 2. detection on photos the detector never saw
print("=" * 100)
print("2. DETECTION ON UNSEEN PHOTOS (NeedsProcessing: taken 9-10 Oct 2025; detector trained 4 Sep 2025)")
yolo = YOLO(os.path.join(MODELS, "1_detection.pt"))
raw = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(DATA, "NeedsProcessing")) for f in fs)
scr = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(DATA, "Scrapped")) for f in fs)


def det_stats(paths, mode, imgsz):
    tops, n_at = [], {0.25: 0, 0.5: 0, 0.8: 0, 0.9: 0}
    for p in paths:
        bgr = cv2.imread(p)
        src = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB) if mode == "RGB array (production)" else bgr
        res = yolo.predict(source=src, imgsz=imgsz, conf=0.01, verbose=False)[0]
        confs = res.boxes.conf.numpy() if len(res.boxes) else np.array([0.0])
        tops.append(confs.max())
        for t in n_at:
            n_at[t] += int((confs >= t).any())
    tops = np.array(tops)
    return f"top-conf p10/p50/p90 = {pct(tops, (10, 50, 90))}  " + "  ".join(f"≥{t}: {n_at[t] / len(paths):.0%}" for t in n_at)


for set_name, paths in (("175 phone photos (unseen)", raw), ("146 scraped catalogue scans", scr)):
    for mode, imgsz in (("RGB array (production)", 512), ("BGR array (correct)", 512), ("BGR array (correct)", 640)):
        print(f"{set_name:28s} {mode:24s} imgsz={imgsz}: {det_stats(paths, mode, imgsz)}")

# ---------------------------------------------------------------- 3. the production pipeline end to end
print("=" * 100)
print("3. PRODUCTION PIPELINE ON THE UNSEEN PHONE PHOTOS: RGB->YOLO(imgsz 512, conf 0.9) -> crop -> deployed embedding -> search")
gallery = embed(EMBEDDERS["deployed (fine-tuned R18, 256-d)"], imgs)
base_of = [re.sub(r"_\d+_0\.\d+\.jpg$", "", os.path.basename(f)) for f in files]
found = none = r1 = total = 0
cos_top = []
for p in raw:
    cls = classes.index(os.path.basename(os.path.dirname(p)))
    rgb = cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB)
    res = yolo.predict(source=rgb, imgsz=512, conf=0.9, verbose=False)[0]
    if not len(res.boxes):
        none += 1; continue
    x1, y1, x2, y2 = map(int, res.boxes.xyxy[res.boxes.conf.argmax()])
    q = embed(EMBEDDERS["deployed (fine-tuned R18, 256-d)"], [rgb[y1:y2, x1:x2]])[0]
    keep = np.array([b != os.path.splitext(os.path.basename(p))[0] for b in base_of])  # exclude crops of the same photo
    s = gallery[keep] @ q
    top = np.argmax(s)
    total += 1; r1 += labels[keep][top] == cls; cos_top.append(s[top]); found += s[top] >= 0.975
print(f"photos with no detection at conf 0.9: {none}/{len(raw)}")
print(f"of the rest: top-1 is the right cap {r1}/{total} = {r1 / max(1, total):.1%};  service would say 'found' (cos>=0.975) for {found}/{total}")
print(f"top-1 cosine p10/p50/p90 = {pct(np.array(cos_top), (10, 50, 90))}")
print("NOTE: the gallery crops come from these same photo sessions and were used to train the embedding model -> optimistic.")
