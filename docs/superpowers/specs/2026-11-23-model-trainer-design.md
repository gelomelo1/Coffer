# Model trainer and critical AI fixes — design

Date: 2026-11-23 · Follows: `docs/research/2026-11-23-ai-finetuning-analysis.md` (§E "Critical", §B, §C).

## Intent

Make training the two Coffer models (cap detection, cap embedding) something an administrator does in a few clicks
in Coffer.Manager, with a result that can go live immediately and a test-set report that says — in numbers —
whether the new model is better than the one live now. At the same time fix the six critical problems that make
today's results misleading.

## Goals

- Six fixes: cosine similarity end to end; one self-describing model format the service always loads; brand-level
  scraped classes out of the embedding training data; identity-preserving augmentation; a correct LR schedule; YOLO
  gets images in the channel order it expects (and at its training size).
- A **Model training** view in Coffer.Manager (replaces "Similarity Check Training") with a Detection and an
  Embedding tab: pick data, adjust training settings, start, watch progress, stop.
- Every run writes a **run folder** (settings, data manifest, log, progress, model, report) — repeatable and
  comparable later.
- Every finished run is **evaluated on a test set the admin provides** (required — the trainer refuses to start
  without one) and compared with the model currently live for the chosen item type, on the same test set.
- The output is **ready to use**: correct file name and embedded metadata (architecture, input size, normalisation,
  recommended thresholds); one button uploads it to an item type through the existing upload path, and the service
  picks it up without a restart.
- Training uses the **GTX 1060** (CUDA build of PyTorch in the Manager environment); CPU still works.

## Non-goals

- An annotation tool inside the Manager (Label Studio stays; its YOLO export is the input format).
- Training on the server; automatic relabelling of data; new backbones such as DINOv2 (the model format leaves room
  for them later).
- Packaging the Manager or Label Studio as executables (separate pieces of work, after this one).

## Anti-goals

- A model that "looks better" because it was tested on photos it trained on: the trainer must refuse overlapping
  train/test data.
- A deployment that silently breaks image checks: the backend must reject a model the service cannot load.

## Approaches considered

1. Train in the Manager process on a background thread — simplest, but a crash or GPU out-of-memory takes the whole
   Manager down, stopping is awkward, GPU memory is not reliably freed.
2. **Chosen:** the Manager launches each run as a separate worker process that writes a run folder; the Manager
   watches the folder. Robust stop/crash isolation, frees the GPU, and gives a durable history of runs.
3. Train on the server — dropped: the server is CPU-only in Docker and would compete with live traffic.

Test set: the admin photographs a dedicated test set (option B). No automatic split of the training data.

## Design

### Run folder (the contract between Manager, worker and report)

`<runs root>/<yyyyMMdd-HHmmss>_<detection|embedding>_<name>/` (runs root chosen once in the Manager, remembered):

| File | Content |
|---|---|
| `config.json` | every setting of the run, the data folders, the item type to compare with, seed |
| `manifest.json` | every training / validation / test image: relative path, class, SHA-1 — the dataset version |
| `log.txt` | human-readable log |
| `progress.json` | phase (`checking`, `training`, `evaluating`, `done`, `failed`, `stopped`), epoch / total, latest metrics |
| `metrics.csv` | per-epoch training and validation metrics |
| model file | `detection.pt` or `embedding.pt` with embedded metadata (below) |
| `report.json`, `report.md` | test-set results for the new and the live model, differences, recommended thresholds |

The worker is started as `python -m training.worker <run dir>` (later the packaged executable gets an equivalent
`--train-worker <run dir>` switch). Stop = terminate the process; the Manager then marks the run `stopped`.

### Data formats and checks (before any training starts)

- **Detection:** a YOLO dataset as exported by Label Studio (`data.yaml`, `images/`, `labels/`, train and val);
  **test set:** a separate YOLO-format folder. Checks: one class `cap`, every image has a label file, no image (by
  SHA-1) appears in more than one of train / val / test.
- **Embedding:** a folder of class sub-folders, **one sub-folder per cap variant**; validation = 15% of the training
  classes held out by the worker (class-disjoint, for early stopping); **test set:** a separate folder of class
  sub-folders. Checks: ≥ 2 images per class; no image shared with training (SHA-1); **no test class name equal to a
  training class name** (test caps must be unseen); warnings for classes with < 4 images.
- Failing checks stop the run in the `checking` phase with a clear message.

### Training

- **Detection:** Ultralytics; base model selectable (YOLOv8n/s, YOLO11n/s, or the live model of the item type);
  editable: epochs, image size, batch, patience, freeze layers, lr0, and augmentation (degrees, scale, translate,
  fliplr, mosaic, HSV). Best checkpoint by validation mAP50-95.
- **Embedding:** backbone ResNet18 / ResNet50 (ImageNet), embedding size, image size, frozen stages, epochs, P×K
  batch (classes × images), LR, loss (batch-hard triplet, or Sub-center ArcFace + triplet), and augmentation
  (rotation, perspective, brightness/contrast, saturation, hue capped at 0.02, blur, small random erasing). No flips
  (the option is not offered). Cosine LR schedule stepped once per epoch. Early stopping and best checkpoint by
  validation Recall@1 on the held-out classes. Seeded.
- Device: CUDA when available, else CPU (shown in the Manager).

### Evaluation (always, after training)

On the admin's test set, for the new model **and** the live model of the selected item type (downloaded through a
new admin endpoint; skipped with a note when the type has none):
- Detection: precision, recall, F1, mAP50, mAP50-95; the recommended confidence threshold (best F1 on the test set,
  never above 0.9).
- Embedding: Recall@1/5/10 and mAP@R (leave-one-out over the test set), genuine vs impostor cosine statistics, and
  recommended thresholds — **found** at ≤ 1% false matches, **similar** at ≤ 5%.
- The report shows each metric for both models and the difference ("R@1 0.81 → 0.88, +0.07"), plus test-set size so
  small differences are not over-read.

### Model format (ready to use)

- **Embedding** `.pt` = a dict: `format: "coffer.embedding.v1"`, `backbone`, `embedding_dim`, `image_size`, `mean`,
  `std`, `thresholds {found, similar}`, `classes`, `run_id`, `state_dict`. The legacy raw ResNet18 state dict still
  loads (treated as ResNet18, 256-d, 224 px, default thresholds).
- **Detection** `.pt` = the Ultralytics checkpoint plus a `coffer` entry: `{format: "coffer.detection.v1", imgsz,
  confidence, run_id}` (Ultralytics ignores extra keys).
- "Use for item type…" uploads through the existing *Item types › Upload models* path; the class count is filled in
  automatically, so the backend's naming (`{id}_detection.pt`, `{id}_similarity_{n}.pt`) stays as it is.

### Service and backend changes

- Python service: one model loader that reads the metadata (and the legacy format), caches loaded models per file
  and reloads when the file changes (instant go-live, no per-request loading); passes BGR to YOLO at the model's
  `imgsz` with its `confidence`; embedding preprocessing from metadata; thresholds from metadata.
- Python service: the vector collection uses cosine distance. On start-up, an `l2` collection is migrated once
  (read all ids, vectors, metadata → recreate with cosine → re-add); similarity = 1 − cosine distance; the
  in-photo duplicate merge uses the same scale.
- Python service: `POST /models/validate` loads a model file and runs one dummy image through it.
- Backend: after saving uploaded models, call the validate endpoint; on failure delete the files and return an error
  (`modelInvalid`) — a model the service cannot load is never published.
- Backend: admin endpoint to download an item type's current model file (for the Manager's comparison).

### Data fix (problem 3)

Move `Processed/cap36`–`cap60` (brand-level scraped groups) to `Excluded/brand-level/` beside it — moved, not
deleted, so they can be split into variants later.

### Environment

Install the CUDA build of PyTorch/torchvision in the Coffer.Manager venv, choosing the CUDA variant that still
supports the GTX 1060 (compute capability 6.1); verify with a GPU smoke test. Update the Manager requirements.

## Testing

- Manager: unit tests for data checks (overlap by hash, class-name overlap, YOLO structure), run folder / manifest,
  metrics (Recall@K, mAP@R, threshold choice), report comparison, model metadata; a smoke test running the worker on
  a tiny synthetic dataset on CPU for both model kinds.
- Python service: legacy and new model loading, cache reload on file change, BGR conversion, cosine migration
  (l2 → cosine keeps ids, vectors, metadata), validate endpoint.
- Backend: upload rejected when validation fails; model download is admin-only.
- Device check: train both kinds on real data on the GPU with a temporary verification split (until the real test
  photos exist), deploy to an item type, run an image check in the app.

## Left to the builder

Widget layout of the Model training view; polling interval; exact Ultralytics argument mapping; how the live model is
cached locally in the Manager; report Markdown layout.
