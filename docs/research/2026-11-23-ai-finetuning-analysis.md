# Coffer – Analysis of the AI fine-tuning pipelines (object detection and image embedding)

Date: 2026-11-23 · Scope: investigation only — no pipeline, database or model was changed, nothing was trained.
Evidence: the source code (Coffer.Manager, Coffer.PythonService, Coffer backend), the training data on disk
(`szakdolgozat/training/ObjectSimilarity`), the two deployed model files, the thesis (BFK4J4_Szakdolgozat, §5.3 and
§6, figure 48 = "page 71 diagram"), and a read-only inference run of the deployed models
(script: [`ai_eval_2026-11-23.py`](ai_eval_2026-11-23.py), output in §A.5). Literature with links is in §G.

---

## Summary

- **The embedding model's quality is unknown, not proven.** There is no held-out evaluation: the thesis figure 48
  (t-SNE) is drawn from *training* images with *training* augmentation, and colours repeat every three classes (60
  classes on the 20-colour `tab20` map), so it cannot show separation. On its own training crops the deployed model
  reaches Recall@1 0.994 — but an *untuned* ImageNet ResNet18 already reaches 0.922 on the same crops (0.874 on the
  phone photos) without ever seeing them. How much the fine-tuning helps on caps it has **not** seen — which is every
  user's cap — has never been measured.
- **Five defects make today's results misleading regardless of data** (§E, "Critical"): the vector store uses squared
  L2 while the code reads it as cosine (the "found" threshold is really cosine ≥ 0.975, not 0.95); the Manager's
  training button produces a ResNet50 that the service cannot load (it builds a ResNet18); 25 of the 60 embedding
  classes are brand groups of *different* caps, teaching the model the opposite of the task; hue jitter of ±72° and
  mirror flips destroy exactly the cues that tell look-alike caps apart; the LR scheduler is driven by the loss value.
- **The detector is in better shape than the embedding model.** On 175 phone photos taken after it was trained it
  finds a cap in 97% of photos at the production threshold (0.9), with median confidence 0.987. The weaknesses are
  the evaluation (10 validation images, no test set, likely same-session leakage), a single photographer/phone/home
  setting, the 0.9 threshold, and RGB arrays fed where BGR is expected.
- **Data to collect** (details and reasoning in §B, §C, §D): detection ≈ 800–1,500 diverse original photos
  (recommended), embedding ≈ 400–600 *variant-level* classes × 8–10 photos from ≥ 3 sessions (recommended). For the
  embedding model, **more classes beats more images per class**, because production is open-set: the model must work
  on caps it was never trained on.
- **Cheapest big win first:** before collecting data, build a proper class-disjoint test set (~50–100 unseen caps)
  and measure a *frozen* modern backbone (DINOv2) against the current model. Strong frozen features may already beat
  a ResNet18 fine-tuned on 60 classes; fine-tuning then becomes a measured improvement, not an assumption.
- **Production readiness:** the detector is close (needs a diverse test set and threshold calibration); the
  embedding/identification path is **not** production-ready (§F).

---

## A. Current implementation

### A.1 Where things live

| Step | Where | Notes |
|---|---|---|
| Detection annotation | Label Studio (external), 81 train + 10 val photos (thesis §5.3.1) | the YOLO dataset (`datasets/dataset/data.yaml`) is **not on disk** any more → not reproducible |
| Detection training | Ultralytics CLI/script, not in the repo (thesis fig. 12) | read back from the checkpoint's `train_args` |
| Crop tool | `Coffer.Manager/similarity_check_training/crop_images.py` | YOLO via file path, default conf 0.25, no padding |
| Embedding training | `.../training.py` (ResNet18, produced the deployed model) and `.../training_best_try.py` (ResNet50, **the one the Manager button runs**) | no validation split, saves last epoch |
| Vector DB tools | `.../create_vector_database.py`, `insert_to_collection.py`, `list_collection.py` | Chroma collection created with default distance |
| Model upload / publish | Manager › Item types (backend `ItemTypeFiles`) | checks zip format and class count only |
| Serving | `Coffer.PythonService` (`app.py`, `initialize.py`, `crop_objects_from_image.py`, `image_to_cnn_embedding.py`, `build_image_check_response.py`) | both models reloaded on **every** request |

Manager has no dataset management, splits, experiment tracking, evaluation, model comparison or monitoring. Training
runs on the Tk UI thread and ends in a blocking `plt.show()`; the "Model name" field is ignored (the ResNet50 script
always writes `cap_similarity_model.pt`).

### A.2 Object detection (deployed `1_detection.pt`, from its checkpoint)

| Item | Value |
|---|---|
| Architecture / weights | YOLOv8n (3 M params), COCO-pretrained, 1 class `cap` |
| Training | 50 epochs, imgsz 640, batch 16, optimizer `auto` (SGD/AdamW chosen by Ultralytics), lr0 0.01, lrf 0.01, momentum 0.937, wd 5e-4, warmup 3, `freeze` none, `close_mosaic` 10, seed 0 |
| Augmentation | Ultralytics defaults: HSV (h 0.015, s 0.7, v 0.4), translate 0.1, scale 0.5, fliplr 0.5, mosaic 1.0; no rotation/shear/perspective/mixup/copy-paste (`erasing` and `auto_augment` only affect classification models) |
| Data | 81 training + 10 validation photos (thesis); no test set |
| Reported val metrics | P 0.956 · R 0.960 · mAP50 0.987 · mAP50-95 0.870 — on **10** images |
| Inference | `imgsz=512` (trained at 640), `conf=0.9` (`OBJECT_DETECTION_THRESHOLD`), image passed as an **RGB** NumPy array |

### A.3 Embedding (deployed `1_similarity_60.pt`, trained by `training.py`)

| Item | Value |
|---|---|
| Architecture | ResNet18 (ImageNet-1k V1) → 512 → Linear 256 → ReLU → Dropout 0.4 → Linear 256 → L2-normalise; plus a 60-way linear classifier on the normalised embedding |
| Frozen | `layer1`, `layer2` (`requires_grad=False`, but their BatchNorm statistics still update in train mode) |
| Loss | 0.7 × TripletMarginLoss(margin 0.2) with semi-hard TripletMarginMiner + 0.3 × CrossEntropy |
| Sampler | `MPerClassSampler(m=4)`, batch 32 → 8 classes × 4 images per batch |
| Optimiser | AdamW, discriminative LRs (1e-5 … 3e-4 backbone, 1e-3 heads), wd 1e-4 |
| Scheduler | `CosineAnnealingLR(T_max=epochs)` but called as `scheduler.step(avg_loss)` (**bug**, §E) |
| Epochs | 20, last epoch saved; no validation, early stopping, checkpoint selection, seed or run record |
| Preprocessing | `Resize((224,224))` (aspect squashed; crops are ≈ square so this is mild), ImageNet normalisation |
| Augmentation | `RandomRotation(180)`, `ColorJitter(0.4, 0.4, 0.4, hue=0.2)`, `RandomHorizontalFlip`, `RandomVerticalFlip`, `RandomPerspective(0.1, p=0.5)`, `GaussianBlur` (p 0.2) — all applied on the fly, independently, each epoch |
| Data | `Processed/`: 60 classes, 321 crops (49 classes have exactly 5) |
| Evaluation | t-SNE of 10 training batches (thesis fig. 48) |

**The data, inspected.** Classes `cap01–cap35` are the author's phone photos: the *same* cap, 5 photos, taken in
2–3 sessions over 1–2 days, one phone, home backgrounds (wood, hand, white). Classes `cap36–cap60` are web-catalogue
scans (`au-00006-big.jpg`, …): flat, evenly lit, white background — and each class groups **different variants of one
brand** (e.g. `cap36` = several Foster's designs in different colours; `cap45` = several Puntigamer designs, some with
"open/auf" text; `cap38` = Quilmes variants). The thesis confirms most training images were scraped. The task needs
*variant-level* identity, so these 25 classes teach the model to merge exactly the caps it must separate.

### A.4 Serving pipeline (what a user's upload goes through)

1. Backend → `POST /image_check/{typeId}/{collectionId}`.
2. `initialize_models` loads `{id}_detection.pt` and `{id}_similarity_{n}.pt` **from disk on every call** (n only
   sizes the unused classifier head).
3. YOLO at imgsz 512, conf ≥ 0.9; each box is cropped tightly (no margin).
4. Each crop → ResNet18 embedding (256-d, L2-normalised).
5. Crops of one photo are merged into a "quantity" if their **true cosine** ≥ 0.95.
6. Chroma query (top 3, filtered to the user's collection). The collection uses `"space": "l2"` (verified in
   `chroma.sqlite3`: `{"hnsw":{"space":"l2",…}}`), i.e. squared L2. The code computes `similarity = 1 − distance`,
   which for unit vectors is `2·cos − 1`. So **"found" = cos ≥ 0.975** and **"similar" = cos ≥ 0.925** — not the 0.95
   / 0.85 written in `config.py`. In-image merging (step 5) and DB matching use different scales.
7. Response per crop: `found` / `not found`, quantity, up to 3 similar item ids. There is no "uncertain" state and no
   calibration behind either threshold.

### A.5 Measured behaviour of the deployed models (read-only inference)

**Retrieval, leave-one-out over the 321 crops** (each crop queries the other 320). The deployed model has *trained*
on all of them; the ImageNet baselines have never seen them.

| Model | Classes | R@1 | R@5 | mAP@R |
|---|---|---:|---:|---:|
| Deployed (fine-tuned R18) | all 60 | 0.994 | 1.000 | 0.784 |
| Deployed | phone 01–35 | 0.994 | 1.000 | 0.763 |
| Deployed | scraped 36–60 | 0.993 | 1.000 | 0.810 |
| ImageNet R18, no tuning | all / phone / scraped | 0.922 / 0.874 / 0.979 | 0.984 / 0.977 / 0.993 | 0.620 / 0.554 / 0.699 |
| ImageNet R50, no tuning | all / phone / scraped | 0.838 / 0.754 / 0.938 | 0.975 / 0.960 / 0.993 | 0.560 / 0.500 / 0.632 |

Deployed model, cosine of same-cap pairs p5/p50/p95 = 0.904 / 0.984 / 0.997; different-cap pairs = −0.554 / −0.012 /
0.646, **maximum 0.983**. Share of pairs over the service thresholds: "found" (cos ≥ 0.975) — 66% of same-cap pairs,
0.01% of different-cap pairs; "similar" (cos ≥ 0.925) — 92% / 0.18%. On *training* data a third of genuine pairs
already miss "found", and the closest different-cap pair exceeds it. Cosine between a crop and its mirror image:
median **0.995** (mirrored text and logos are invisible to the model).

**Detection on photos the detector never saw** (`NeedsProcessing`: 175 phone photos from 9–10 Oct 2025; detector
trained 4 Sep 2025) and on 146 catalogue scans:

| Set | Input | imgsz | top conf p10/p50/p90 | ≥ 0.5 | ≥ 0.8 | ≥ 0.9 |
|---|---|---:|---|---:|---:|---:|
| phone photos | RGB array (production) | 512 | 0.953 / 0.987 / 0.996 | 100% | 98% | 97% |
| phone photos | BGR (correct) | 512 | 0.951 / 0.986 / 0.996 | 99% | 99% | 97% |
| phone photos | BGR (correct) | 640 | 0.937 / 0.979 / 0.992 | 99% | 97% | 93% |
| scans | RGB array (production) | 512 | 0.817 / 0.966 / 0.986 | 98% | 90% | 78% |
| scans | BGR (correct) | 512 | 0.857 / 0.975 / 0.989 | 99% | 93% | 86% |
| scans | BGR (correct) | 640 | 0.632 / 0.931 / 0.976 | 95% | 82% | 61% |

No ground-truth boxes exist for these photos, so this measures "found a cap with confidence X", not box quality or
false positives. Caps fill most of these frames, which is why 512 beats 640 here; that will not hold for small caps
in larger scenes.

**Whole production pipeline on those 175 photos** (RGB → YOLO 512/0.9 → crop → embedding → nearest of the 321 crops,
excluding crops of the same photo): 6 photos (3.4%) get no detection; of the rest, the nearest crop is the right cap
in 98.8%, but the service would say "found" for only 83%. This is an upper bound: the gallery comes from the same
sessions and was used for training.

### A.6 Bugs and methodological weaknesses (all verified in code)

| # | Finding | Where | Effect |
|---|---|---|---|
| 1 | Chroma collection uses squared L2; code treats `1 − d` as cosine | `app.py` (`get_or_create_collection` without space), `build_image_check_response.py` | thresholds mean cos 0.975 / 0.925; in-image merge uses true cosine 0.95 |
| 2 | Manager trains ResNet50; service builds ResNet18; upload doesn't check architecture | `view.py` imports `training_best_try`; `image_to_cnn_embedding.py`; `ItemTypeFiles.SaveModelsAsync` | the next model trained in Manager is accepted, published, then fails to load → `image_check` returns `{"status":"error"}` |
| 3 | Brand-level classes (25/60) in a variant-level task | `Processed/cap36–60` | trains the model to merge look-alike variants |
| 4 | `ColorJitter(hue=0.2)` = ±72° hue rotation; horizontal + vertical flips | `training.py` | colour and text orientation — the main cues separating look-alikes — become noise |
| 5 | `CosineAnnealingLR.step(avg_loss)` passes the loss as the epoch | `training.py` | deprecated call; the LR follows the loss value instead of annealing |
| 6 | No validation/test split; t-SNE on training data with training augmentation; `tab20` for 60 classes | `training.py` | no generalisation evidence; figure 48 cannot show class separation |
| 7 | RGB array given to YOLO, which expects BGR arrays | `uploadfile_to_numpy` → `crop_objects_from_image` | small loss on photos, −8 pts at conf 0.9 on scans |
| 8 | Detection conf 0.9 (uncalibrated); inference size ≠ training size | `config.py`, `crop_objects_from_image.py` | 3% of good photos lose their cap; size mismatch is untested |
| 9 | Models loaded from disk per request | `app.py` | latency, not quality |
| 10 | Detection: 10 val images, no test, likely same-session leakage, dataset not kept | thesis, checkpoint | mAP 0.987 has a very wide confidence interval and may be inflated |
| 11 | Last epoch saved, no early stopping or run metadata (data version, seed, augmentations, metrics) | both | not reproducible, no basis to compare versions |
| 12 | Tight crops without margin; crop tool keeps a crop at conf 0.32 | `crop_*` | box jitter cuts cap edges; one doubtful crop in training data |
| 13 | Class count must be known to *load* the model, only to size an unused classifier | `initialize.py`, file naming | couples deployment to training details |

---

## B. Object detection

### B.1 Assessment

Detecting "a bottle cap" is a single, visually distinctive class on top of COCO pretraining, which is the easy end of
detection. The measured 97% detection at conf 0.9 on unseen photos shows the model works **for the conditions it was
trained in**: one photographer, one phone, home scenes, caps filling much of the frame. What is unknown is everything
the task statement lists: other phones, outdoor light, cluttered backgrounds, small or distant caps, several caps,
partial occlusion, look-alike round objects (coins, buttons, jar lids), crushed or bent caps, and box tightness.

### B.2 Answers to the questions

1. **Is ~100 originals enough?** For a demo, yes; for "any user's photo", no. Pretraining makes a single distinctive
   class learnable from ~100 images (the few-shot detection literature fine-tunes from as few as 10–30 examples per
   novel class — Wang et al. 2020), but those results come with large variance and are measured in-distribution.
   Ultralytics' rule of thumb (≥ 1,500 images and ≥ 10,000 instances per class) is aimed at "best results" across
   general classes and overstates what one simple class needs, but it gives an upper scale.
2. **How much can augmentation compensate?** Geometric/photometric augmentation (mosaic, scale, HSV, translation)
   gives robustness to variations *of scenes you already have*; it cannot create new backgrounds, cameras, lighting
   spectra or occlusion patterns. Learned augmentation helps most on small datasets (Zoph et al. 2019), and pasting
   objects onto new backgrounds is a strong, simple augmentation (Ghiasi et al. 2021) — the closest thing to "new
   scenes" augmentation can offer.
3. **Useful:** mosaic (off for the last epochs, as now), scale 0.5–0.9 (small/distant caps), translate, HSV
   *value/saturation* (lighting), small rotation (caps are round — any angle is realistic), mild perspective
   (camera tilt), motion/defocus blur, JPEG/noise (cheap phones), copy-paste of cap instances onto real background
   photos, random erasing/cutout (partial occlusion — Zhong et al. 2020), horizontal and vertical flips (a detector
   only needs "cap-ness", so mirrored caps are fine here).
4. **Harmful or useless:** large hue shifts are acceptable for detection (colour isn't the class) but strong mixup
   produces ghost objects that blur box boundaries; extreme scale-down produces caps smaller than any real upload;
   heavy perspective creates impossible shapes. `erasing`/`auto_augment` in the current args have no effect on
   detection training.
5. **Diversity of originals:** ≥ 10 distinct background types (wood, cloth, paper, hands, glass, metal, outdoors,
   cluttered desks), ≥ 3 phones (one older), daylight/warm indoor/flash/dim, distances from close-up to "cap is 5% of
   the frame", tilted views, 1 / 2–5 / many caps per photo, other round objects as distractors, and 5–10% photos with
   no cap at all (Ultralytics recommends 0–10% background images).
6. **Annotations:** every cap in every photo must be boxed (partial labelling teaches the model to ignore caps).
   Instances matter more than images; the ranges in §B.4.
7. **Collect or improve method first?** Do both, in this order: (a) fix the input colour order and build an honest
   test set (no new training needed), (b) collect diverse photos — for detection the limit is coverage of conditions,
   not the optimiser, (c) then tune.
8. **Better strategies for small data:** keep a pretrained detector and fine-tune it; use a slightly larger model
   (YOLOv8s/YOLO11s) if test recall on small caps is weak; fine-tuning only the head first is what few-shot detection
   papers rely on (Wang et al. 2020).
9. **Freeze then unfreeze?** Worth trying when data is < ~300 images: freeze the backbone (`freeze=10`) for a first
   run, then fine-tune everything from that checkpoint at a lower LR. Ultralytics' own experiment shows full training
   gives the best mAP once data is adequate, while freezing trains faster with a small accuracy cost. Decide by
   test-set results, not by default.
10. **Overfitting:** session-grouped splits, early stopping on val mAP50-95 (`patience`), the augmentations above,
    background images, and comparing train vs val curves; with 81 photos and 50 epochs, val loss is the signal to
    watch.
11. **Confidence threshold:** choose it on the validation set from the precision–recall curve against a target, e.g.
    "recall ≥ 98% with ≤ 2% false-positive images", then confirm on the test set. A cap that is missed blocks the
    user; a false box costs one tap to discard — for Coffer, favour recall (likely ~0.4–0.6, not 0.9).
12. **Before deploying:** evaluate on a frozen, session-disjoint test set; report P, R, F1 at the chosen threshold,
    mAP50 and mAP50-95, false positives per image on cap-free photos, and recall per condition (light, background,
    size, multi-cap, phone).

### B.3 Recommended training methodology

Ultralytics, YOLOv8s or YOLO11s at imgsz 640 (train and infer at the same size, as Ultralytics recommends), from
COCO weights; 100–150 epochs with `patience` 30; keep the default augmentations, add `degrees` 15–30, `perspective`
≤ 0.0005, `copy_paste` (needs segments, or do it offline), and blur/noise offline; 5–10% background images; select
`best.pt` by validation mAP50-95; then pick the confidence threshold on validation (B.2-11). Fix the serving side:
pass BGR (or a PIL/RGB image), same imgsz as training, add a 5–10% margin to crops.

### B.4 Dataset size (original photographs, not augmented samples)

The numbers assume one class, COCO-pretrained YOLO, careful full annotation, and that new photos come from several
people/phones. Test-set sizes come from the binomial confidence interval: to measure a recall of ~95% to within
±5 pts needs ~75 instances, within ±3 pts ~200, within ±2 pts ~450.

| Scenario | Original photos | Annotated caps | Diversity | Val / Test (photos) | Limits |
|---|---:|---:|---|---|---|
| Minimum viable | 250–400 | 400–800 | ≥ 3 phones, ≥ 10 backgrounds, indoor + outdoor, 1–5 caps/photo, 10% no-cap, distractors | 50 / 80 (≈ 150 caps) | recall known to ±5 pts; small/occluded caps under-covered |
| Recommended | 800–1,500 | 2,000–4,000 | + ≥ 5 phones, ≥ 5 people, cluttered scenes, small caps, bent/used caps | 150 / 250 (≈ 450 caps) | known to ±2–3 pts; rare conditions still thin |
| Production-oriented | 2,500–5,000 | 8,000–12,000 | + real user uploads (with consent), every condition bucket ≥ 50 photos | 400 / 600, plus a monitored live sample | Ultralytics' general guide (≥ 10,000 instances); diminishing returns for one simple class |

Augmentation multiplies *training samples* (Ultralytics generates new mosaics every epoch), not the number of
distinct scenes; the table counts photographs only.

---

## C. Image embedding

### C.1 Assessment

The model is a sensible starting shape (pretrained CNN, normalised embedding, triplet loss with mining, P×K
sampling), but: it is evaluated only on its training images; a third of its labels contradict the task; its
augmentation removes the identity cues it must learn; and it is trained on 60 classes while being used on an
**open set** — every user's caps are new classes. With 60 training classes, fine-tuning mainly *memorises those 60
caps* (R@1 0.994 on training data vs 0.874 for the untuned backbone on phone photos); whether it improves on unseen
caps is unknown and plausibly not much. The thresholds (cos 0.975 / 0.925) were never calibrated.

### C.2 Answers to the questions

1. **Is 60 classes × 5–7 images enough?** No. Metric-learning benchmarks train on hundreds to tens of thousands of
   classes and test on *unseen* ones (Stanford Online Products: 11,318 training products × ~5 photos; CUB: 100
   training classes × ~60). With 60 classes the model sees too few "ways caps can differ" to generalise; with 5 photos
   from 2–3 sessions it sees too few "ways one cap can look".
2. **Is the architecture appropriate?** ResNet18 + MLP head is adequate as a baseline but weak for fine-grained
   *instance* retrieval. Modern self-supervised ViTs give much stronger off-the-shelf instance retrieval (DINOv2
   reports large gains on revisited Oxford/Paris; the ILIAS benchmark evaluates frozen backbones for instance-level
   retrieval). One caution: a 2025 study found DINOv2 retrieval degrades when colour must match — exactly the cap
   case — so measure it, don't assume it.
3. **Learning cap features or shortcuts?** Unknown without a test set. Risks present in the data: scraped classes are
   all white-background scans and phone classes are all home photos (a model can tell the domains apart without
   looking at the cap); phone sessions share backgrounds (the measured wrong neighbours did not cross domains, but on
   training data that proves little). Test it: query with the same cap on a new background; check that different
   caps photographed on the same background do *not* cluster.
4. **Positives and negatives:** positives = photos of the same *variant*, preferably from different sessions (that is
   the variation production sees). Negatives: everything else; the valuable ones are **hard negatives** — other
   variants of the same brand, same-colour caps, same-shape logos. Keep a "family" tag (brand) per class so batches
   can deliberately contain siblings.
5. **Would metric learning help?** It is already metric learning. What helps is better sampling and a better
   objective; Musgrave et al. 2020 showed that, under fair evaluation, most "new" losses gain little over well-tuned
   classic ones — the data, the sampling and the evaluation protocol matter more than the loss name.
6. **Which loss?** For a few hundred classes with few images each: a proxy-based margin loss (ArcFace / CosFace, or
   **Sub-center ArcFace**, which tolerates noisy or multi-modal classes) or supervised contrastive loss (Khosla et al.
   2020, more stable across hyperparameters) are the strongest well-documented options; the batch-hard triplet loss
   (Hermans et al. 2017) is a solid baseline. All are available in `pytorch-metric-learning`, already a dependency.
   Recommendation: SubCenterArcFace (k=2–3) + a small weight of batch-hard triplet, with a BNNeck-style split between
   the metric feature and the classifier (Luo et al. 2019), and *compare* against plain triplet on the same test set.
7. **Hard-negative mining?** Yes, but structured: batch-hard or distance-weighted sampling (Wu et al. 2017) inside
   P×K batches, plus **family-aware batches** (put 2–3 sibling variants in the same batch). Mining cannot find hard
   negatives that aren't in the batch or the dataset — collecting sibling variants is what makes it work.
8. **Very similar classes:** label at variant level; record the family; ensure siblings are in the same split; train
   with family-aware batches; evaluate "hard-negative R@1" separately (queries whose sibling is in the gallery); and
   in the app, show the top candidates instead of auto-matching when the top-2 scores are close.
9. **Intra-class diversity:** essential. Five photos from one session are close to one example; three sessions
   (different day, background, light, phone) are what teach invariance. Augmentation cannot replace a new session
   (§D, §C.4).
10. **All layers or part?** With < ~300 classes: freeze the backbone, train a projection head (and maybe the last
    block). With ~500+ classes and 8+ photos each: fine-tune the last 1–2 stages at a low LR. Full fine-tuning on 60
    classes is what produces memorisation.
11. **Stronger pretrained model?** Very likely the single biggest improvement per hour. Candidates: DINOv2 ViT-S/14
    (21 M params, fine on CPU) or ViT-B/14; CLIP ViT-B as a second opinion. First measure them **frozen** on the new
    test set.
12. **Normalisation and comparison:** L2-normalise and use cosine similarity everywhere — create the Chroma collection
    with `space: "cosine"` (it cannot be changed later, so re-index) or convert `cos = 1 − d/2` from squared L2. Use
    one scale for in-image merging and DB search. Optional: average the embedding of a crop and its 90°/180°/270°
    rotations (caps are round) — test-time augmentation that suits the object.
13. **Similarity threshold:** calibrate on a class-disjoint validation set exactly like biometric verification:
    collect genuine (same cap) and impostor (different cap, including siblings) cosine distributions and pick
    thresholds by target error rates — e.g. **auto-match** at false-match rate ≤ 1%, **show candidates** above a lower
    threshold, **"not found"** below it. Re-calibrate whenever the model changes.
14. **Right item vs merely similar:** measure on a gallery that contains siblings and distractors; report R@1 overall
    and on the hard-negative subset; report the false-match rate at the chosen threshold, and the open-set case
    (query whose cap is *not* in the gallery must come back "not found").

### C.3 Recommended architecture and method (in order)

1. **Baseline with no training:** frozen DINOv2 ViT-S/14 (and ViT-B/14) global embedding, cosine; evaluate on the
   class-disjoint test set; compare with the current model. If it wins, deploy it (with calibrated thresholds) even
   before any fine-tuning.
2. **Light adaptation:** frozen backbone + a trained linear/MLP projection head (256-d) with SubCenterArcFace +
   batch-hard triplet, family-aware P×K batches (P 16, K 4). Needs ~100–300 classes.
3. **Partial fine-tuning:** unfreeze the last stage(s) at LR ≈ 1e-5 with layer-wise decay, once ≥ ~500 variant-level
   classes exist. Early stopping on *validation R@1 of unseen classes*.
4. Keep the classifier only as a training aid (BNNeck); serve the embedding alone (no class count in the file name).

### C.4 Augmentation for the embedding model (identity-preserving)

| Transform | Use? | Why |
|---|---|---|
| Rotation 0–360° | **yes** | caps are round; any rotation is a real photo of the same cap; fill with reflection/edge colour, not black |
| Random resized crop, scale 0.6–1.0 | **yes** | mimics detector box jitter and tight/loose crops |
| Perspective (≤ 0.2) / affine shear | **yes** | camera tilt |
| Brightness / contrast (±0.3) | **yes** | lighting |
| Saturation (±0.2) | mild | phone processing |
| **Hue shift** | **no** (≤ 0.02 at most) | colour is identity: a green Heineken turned blue is a different cap |
| **Horizontal / vertical flip** | **no** | mirrors text and logos; mirrored caps don't exist; the model becomes mirror-blind (cos 0.995 today) |
| Gaussian / motion blur, JPEG, noise | **yes** | cheap phones, hand shake |
| Specular highlight / glare overlay | **yes** | metallic caps under lamps |
| Random erasing (small, ≤ 15%) | **yes** | fingers and occlusion; keep small so the logo survives |
| Background replacement | **yes**, for phone photos | break background shortcuts: segment the cap (it's a circle) and paste onto random backgrounds |
| CutMix / MixUp | **no** | blends two identities into one label |

### C.5 Dataset size (original photographs per *variant*)

Reasoning: production is open-set, so generalisation comes mainly from the **number and variety of training
identities**; per-identity photos must cover sessions, because cross-session pairs are the positives production
needs. Benchmarks that work at ~5 images/class (SOP) compensate with ~11k classes; with fewer classes, more and more
varied photos per class are needed. Positive pairs per class = n(n−1)/2 (8 photos → 28 pairs); negatives are
practically unlimited — what must be planned are **hard negatives** (sibling variants).

| Scenario | Classes (variants) | Photos / class | Total originals | Positive pairs | Hard negatives | Val / Test | Diversity per class |
|---|---:|---:|---:|---:|---|---|---|
| Minimum viable | 150 | 6–8 (≥ 2 sessions) | 900–1,200 | ~2,500–4,000 | ≥ 30 families with 2–4 siblings | val 30 classes; test **50 unseen classes** × 6 + 200 distractor caps | 2 backgrounds, 2 light conditions, top + slight tilt |
| Recommended | 400–600 | 8–10 (≥ 3 sessions, ≥ 2 phones) | 3,500–6,000 | ~11,000–27,000 | ≥ 100 families; 30–50% of classes have a sibling | val 60–80 classes; test 100–150 unseen classes + 500 distractors | ≥ 3 backgrounds, indoor/outdoor, 2 phones, worn/clean |
| Production-oriented | 1,500–3,000 | 8–12 (≥ 3 sessions, ≥ 3 phones, several people) | 15,000–30,000 | ~50,000–200,000 | systematic: every brand with > 1 variant | val 150 classes; test 300+ unseen classes + real user uploads | everything above + user-style photos |

How the need changes with the training regime:

| Regime | Classes needed to help | Notes |
|---|---|---|
| Frozen strong backbone, no training | 0 (only a test set of ~50–100 classes) | best first step; quality fixed by the backbone |
| Frozen backbone + trained projection head | ~100–300 | few parameters; low overfitting risk |
| Metric learning, partial fine-tuning (last stages) | ~400–1,000 | the "recommended" row |
| Full fine-tuning | ≳ 1,000–2,000 | below that it memorises training identities (today's case) |

Ten augmented copies of five photos still contain five viewpoints, five backgrounds and at most three lighting
situations; augmentation widens each, it does not add a session. Count only genuinely different photographs.

---

## D. Dataset size comparison

| Model | Scenario | Classes | Original photos per class | Total original photos | Annotated instances / pairs |
|---|---|---:|---:|---:|---|
| Object detection | Minimum | 1 (cap) | n/a | 250–400 | 400–800 boxed caps |
| Object detection | Recommended | 1 | n/a | 800–1,500 | 2,000–4,000 boxed caps |
| Object detection | Production | 1 | n/a | 2,500–5,000 | 8,000–12,000 boxed caps |
| Embedding | Minimum | 150 | 6–8 | 900–1,200 | 2.5–4k positive pairs; ≥ 30 sibling families |
| Embedding | Recommended | 400–600 | 8–10 | 3,500–6,000 | 11–27k positive pairs; ≥ 100 families |
| Embedding | Production | 1,500–3,000 | 8–12 | 15,000–30,000 | 50–200k positive pairs; all multi-variant brands |
| *Today* | detection / embedding | 1 / 60 | n/a / 5 (median) | 91 / 321 (25 classes brand-level scans) | — |

These are planning estimates, not guarantees: what decides the outcome is measured test performance. They move
**down** with a stronger pretrained backbone, careful annotation and photos close to real uploads, and **up** with
weaker backbones, noisy labels or deployment conditions the photos don't cover. One photo set can serve both models:
full-scene photos (boxed for detection) of caps labelled by variant (cropped for embedding).

Collection tip: the planned "Shape What's Next" community page is a natural channel for this — users contributing
photos of their caps (with consent) gives exactly the phone/person/background diversity a single collector cannot.

---

## E. Prioritised improvement plan

### Critical — fix before trusting any result (no new data needed)

| Change | Why | Benefit | Effort |
|---|---|---|---|
| Use cosine consistently: Chroma `space: "cosine"` (re-index) or `cos = 1 − d/2`; one scale for merging and search | thresholds currently mean cos 0.975 / 0.925 | thresholds mean what they say; prerequisite for calibration | low |
| One shared model definition + a metadata file saved with every model (architecture, embedding dim, input size, normalisation, training run id); validate it on upload | Manager trains ResNet50, service loads ResNet18; uploads aren't checked | no silently broken deployments | low–medium |
| Build a frozen **class-disjoint, session-disjoint test set** (≥ 50 unseen caps × 5–6 photos + distractors) and an evaluation script (R@1/5/10, mAP@R, genuine/impostor curves, FMR at threshold) | there is no generalisation measurement at all | every later decision becomes measurable | medium (≈ 300 photos) |
| Relabel or drop the 25 brand-level classes (split into variants or exclude) | labels contradict the task | removes the strongest anti-signal | low |
| Embedding augmentation: no flips, hue ≤ 0.02; fix `scheduler.step()` | identity cues destroyed; LR schedule broken | correct training signal | low |
| Pass BGR (or PIL) to YOLO; same imgsz in training and serving | channel order wrong | removes a silent distribution shift | low |

### High-impact improvements

| Change | Why | Benefit | Effort | New data? |
|---|---|---|---|---|
| Evaluate frozen DINOv2 (ViT-S/B) vs current model on the test set | likely stronger instance features at zero training cost | possibly the largest quality jump available | low | test set only |
| Calibrate thresholds; add an "uncertain → show candidates" state; auto-match only at low FMR | today: uncalibrated, binary | far fewer wrong "found" results | medium (backend + app) | validation set |
| Collect variant-level embedding data per §C.5 "minimum", then "recommended"; tag sessions and families | 60 classes × 5 photos cannot generalise | real generalisation | high (photography) | yes |
| Detection data per §B.4 "minimum"; session-grouped split; threshold from PR curve (≈ 0.4–0.6) | 81 photos, one setting; 0.9 drops 3% | robust detection beyond one home | medium–high | yes |
| Training with validation-based early stopping and best-checkpoint selection, fixed seeds | last epoch saved blindly | reproducible, better checkpoints | low | no |
| SubCenterArcFace + batch-hard triplet, family-aware P×K batches, BNNeck | better use of few images and hard negatives | sharper separation of siblings | medium | benefits from families |

### Additional improvements

- Load models once per type and cache them (today: per request).
- Crop with a 5–10% margin; drop the class count from the model file name (serve the embedding only).
- Rotation test-time augmentation for embeddings (average of 4 rotations).
- Manager: run training in a background thread or process (Tk freezes today); remove the blocking `plt.show()`.
- Log anonymised identification outcomes (suggested id, score, whether the user accepted) to monitor real accuracy
  and drift.

### Longer-term research

- Two-stage retrieval: global embedding for top-K, then local-feature re-ranking (keypoint matching of logos/text) to
  separate near-identical variants.
- OCR of printed text on caps as an extra signal (brand names, "open/auf").
- Semi-supervised growth: user-confirmed matches become new labelled photos (with consent and review).
- Detector + embedding distillation into one lighter model for on-device pre-checks.

### Recommended workflow (Manager vs services)

**Coffer.Manager (offline, admin):** dataset registry (import photos; label = variant id; family = brand; session id
from EXIF/date; condition tags), automatic crop with review, **group-aware splits** (detection: by session; embedding:
class-disjoint val/test + session-disjoint positives), training runs from a saved config (backbone, weights, loss,
augmentations, LR, epochs, seed) in a background process, an evaluation report per run (the metrics in §6 of the task
plus threshold curves), a comparison view between runs, and "promote" → upload with metadata (already partially there
via Item types › Upload models). Every run stores: dataset version (list/hash of image files), split, config, metrics,
chosen thresholds, model hash.

**Python service:** loads models once, validates metadata, uses the model's own preprocessing and thresholds, returns
`found` / `uncertain` / `not found` with scores. **Backend:** keeps which model version answered each check; exposes
the outcomes for monitoring. **App:** shows candidates when uncertain instead of auto-matching.

### Evaluation and acceptance criteria (proposed targets)

Measured on frozen, session-disjoint (detection) and class-disjoint (embedding) test sets of the sizes in §B.4/§C.5:

| Component | Metric | Target before production |
|---|---|---|
| Detection | recall at the operating threshold (single-cap photos) | ≥ 0.98 |
| Detection | precision / false-positive images (cap-free photos with distractors) | ≥ 0.97 / ≤ 2% |
| Detection | mAP50 / mAP50-95 | ≥ 0.95 / ≥ 0.80 (tight boxes → clean crops) |
| Detection | recall in the worst condition bucket (e.g. dim, small caps) | ≥ 0.90 |
| Embedding | R@1 / R@5 on unseen classes (gallery incl. distractors) | ≥ 0.90 / ≥ 0.98 |
| Embedding | R@1 on the hard-negative subset (sibling in gallery) | ≥ 0.80 |
| Pipeline | correct auto-match rate for caps in the collection | ≥ 0.80 (rest → candidates) |
| Pipeline | wrong auto-match rate (false-match rate) | ≤ 1–2% |
| Pipeline | caps *not* in the collection reported as "found" | ≤ 2% |

End-to-end test: photograph caps the models never trained on, enrol some of them into a test collection (gallery),
then upload new photos — both enrolled and not enrolled — through the real service, and score: detection miss,
right top-1, right in top-3 candidates, wrong auto-match, correct "not found". Record whether each failure began at
detection (no/poor box) or at the embedding, to see which model to improve.

---

## F. Production readiness

**Detection — nearly ready for the developer's own conditions, unproven beyond them.** It found a cap in 97% of 175
unseen phone photos at threshold 0.9 (≥ 98% at 0.8). Missing: a test set from other people/phones/scenes, box-quality
and false-positive measurement, a calibrated threshold, and the colour-order fix. Minimum before release: fix the
input, lower and calibrate the threshold, measure on a ~250-photo diverse test set.

**Embedding / identification — not ready.** What prevents reliable identification today: (1) no measurement on caps
the model hasn't seen, which is the production case; (2) training labels that merge look-alike variants; (3)
augmentation that erases colour and text orientation; (4) thresholds on the wrong scale and never calibrated — on
training data a third of genuine pairs fall below "found" and a different-cap pair rises above it; (5) the training
tool produces models the service cannot load. Minimum before release: fixes in §E "Critical", a class-disjoint test
set, a frozen-DINOv2 vs current-model comparison, calibrated thresholds with an "uncertain" state in the app, and
meeting the embedding and pipeline targets above. Until then, present matches as **suggestions** the user confirms,
never as automatic identification.

---

## G. Sources

Object detection
- Ultralytics, *Tips for best training results* (≥ 1,500 images / ≥ 10,000 instances per class; 0–10% background
  images; infer at training size): https://docs.ultralytics.com/yolov5/tutorials/tips_for_best_training_results
- Ultralytics, *Transfer learning with frozen layers*: https://docs.ultralytics.com/yolov5/tutorials/transfer_learning_with_frozen_layers
- Ultralytics, *Predict mode* (NumPy input is HWC **BGR**): https://docs.ultralytics.com/modes/predict
- X. Wang et al., *Frustratingly Simple Few-Shot Object Detection*, ICML 2020: https://arxiv.org/abs/2003.06957
- B. Zoph et al., *Learning Data Augmentation Strategies for Object Detection*, ECCV 2020: https://arxiv.org/abs/1906.11172
- G. Ghiasi et al., *Simple Copy-Paste Is a Strong Data Augmentation Method for Instance Segmentation*, CVPR 2021:
  https://openaccess.thecvf.com/content/CVPR2021/html/Ghiasi_Simple_Copy-Paste_Is_a_Strong_Data_Augmentation_Method_for_Instance_CVPR_2021_paper.html
- K. He, R. Girshick, P. Dollár, *Rethinking ImageNet Pre-training*, ICCV 2019 (with less data, fine-tuning
  hyperparameters must change to avoid overfitting): https://arxiv.org/abs/1811.08883
- Z. Zhong et al., *Random Erasing Data Augmentation*, AAAI 2020: https://arxiv.org/abs/1708.04896

Embedding and metric learning
- K. Musgrave, S. Belongie, S.-N. Lim, *A Metric Learning Reality Check*, ECCV 2020: https://arxiv.org/abs/2003.08505
- H. O. Song et al., *Deep Metric Learning via Lifted Structured Feature Embedding* (Stanford Online Products,
  class-disjoint protocol), CVPR 2016: https://cvgl.stanford.edu/projects/lifted_struct
- A. Hermans, L. Beyer, B. Leibe, *In Defense of the Triplet Loss for Person Re-Identification*, 2017 (batch-hard,
  P×K batches): https://arxiv.org/abs/1703.07737
- C.-Y. Wu et al., *Sampling Matters in Deep Embedding Learning*, ICCV 2017: https://arxiv.org/abs/1706.07567
- P. Khosla et al., *Supervised Contrastive Learning*, NeurIPS 2020: https://arxiv.org/abs/2004.11362
- J. Deng et al., *ArcFace: Additive Angular Margin Loss*, CVPR 2019 / TPAMI: https://arxiv.org/abs/1801.07698;
  Sub-center ArcFace (robust to noisy/multi-modal classes): https://paperswithcode.com/paper/sub-center-arcface-boosting-face-recognition
- H. Luo et al., *Bag of Tricks and a Strong Baseline for Deep Person Re-ID* (BNNeck), CVPRW 2019:
  https://arxiv.org/abs/1903.07071 and https://arxiv.org/abs/1906.08332
- M. Oquab et al., *DINOv2: Learning Robust Visual Features without Supervision*, 2023: https://arxiv.org/abs/2304.07193
- ILIAS: Instance-Level Image retrieval At Scale (benchmark of frozen backbones): https://vrg.fel.cvut.cz/ilias/
- Colour-sensitive retrieval limits of DINOv2 (2025): https://arxiv.org/pdf/2503.09867
- Y. Bai et al., *Products-10K: A Large-scale Product Recognition Dataset*, 2020: https://arxiv.org/abs/2008.10545
- A. Kolesnikov et al., *Big Transfer (BiT)*, ECCV 2020 (few examples per class with strong pretraining):
  https://arxiv.org/abs/1912.11370
- pytorch-metric-learning losses (ArcFace, SubCenterArcFace, triplet, miners): https://kevinmusgrave.github.io/pytorch-metric-learning/losses

Evaluation, leakage and open-set behaviour
- B. Barz, J. Denzler, *Do We Train on Test Data? Purging CIFAR of Near-Duplicates* (9–14% accuracy drop):
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8321059/
- *Data Leakage in Visual Datasets* (2025): https://arxiv.org/pdf/2508.17416v1
- Open-set recognition with calibrated rejection thresholds: https://arxiv.org/pdf/1511.06233 and
  https://arxiv.org/pdf/2511.13775
- Chroma collection configuration (default `l2` is squared L2; `space` fixed at creation):
  https://docs.trychroma.com/docs/collections/configure and https://cookbook.chromadb.dev/core/configuration/
