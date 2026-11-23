# Model trainer and critical AI fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six critical AI problems and give Coffer.Manager a Model training view that trains detection and embedding models on the GPU, evaluates every run on an admin-provided test set against the live model, and produces files that go live through the existing upload.

**Architecture:** A self-describing model format (`coffer_models.py`, byte-identical in the Python service and the Manager) is the contract. The Manager launches each run as a separate worker process that writes a run folder (config, manifest, log, progress, model, report); the view polls the folder. The service loads models through a cache keyed by file stamp, uses cosine similarity and per-model thresholds; the backend refuses a model the service cannot load.

**Tech Stack:** Python 3.13, PyTorch 2.8.0 + torchvision 0.23.0 (CUDA 12.6 build in the Manager venv), Ultralytics 8.3.x, pytorch-metric-learning 2.9, ChromaDB 1.1.1, FastAPI, Tkinter, ASP.NET Core 8 / xUnit.

**Spec:** `docs/superpowers/specs/2026-11-23-model-trainer-design.md` (research: `docs/research/2026-11-23-ai-finetuning-analysis.md`)

## Global Constraints

- Model file names stay `{typeId}_detection.pt` and `{typeId}_similarity_{classCount}.pt`; the backend names them, the Manager fills `classCount` = number of training classes.
- Formats: embedding `.pt` = dict with `format: "coffer.embedding.v1"`; detection `.pt` = Ultralytics checkpoint + `coffer: {format: "coffer.detection.v1", imgsz, confidence, run_id}`.
- Legacy models keep today's effective behaviour: found = cosine 0.975, similar = cosine 0.925, detection confidence 0.9, detection imgsz from the checkpoint's `train_args["imgsz"]`.
- New thresholds: found = threshold where ≤ 1% of impostor pairs pass, similar = ≤ 5%; detection confidence = best F1 on the test set, capped at 0.9.
- Embedding augmentation: no flips (not offered), hue ≤ 0.02. LR scheduler stepped once per epoch without arguments.
- A test set is required; refuse any image (SHA-1) shared between train/val and test; embedding: refuse a test class whose folder name is also a training class.
- Detection data format = Label Studio "YOLO" export: `images/`, `labels/` (same stem, `.txt`), `classes.txt` with exactly one class; the worker holds out 15% of training images for validation, grouped by capture session.
- Manager venv: `torch==2.8.0+cu126`, `torchvision==0.23.0+cu126` from `https://download.pytorch.org/whl/cu126` (cu128 builds dropped sm_61). The Python service keeps its CPU build; no new service dependencies.
- Commits: no `Co-authored-by` or AI trailers. Never push. Don't run prettier.
- Test commands: Manager `venv\Scripts\python.exe -m unittest discover` (from `src/Coffer/Coffer.Manager`), service `venv\Scripts\python.exe -m unittest discover -s tests` (from `src/Coffer/Coffer.PythonService`), backend `"/c/Program Files/dotnet/dotnet.exe" test src/Coffer/Coffer.Tests`.

## Review Focus

1. The same photo in training and test under different file names — must be refused (SHA-1). Test `test_embedding_test_overlap_by_content_is_refused` (Task 4).
2. A run stopped mid-training — process ends, phase `stopped`, no model offered for deployment. Test `test_stopped_run_offers_no_deploy` (Task 7).
3. Models already deployed (raw ResNet18 state dict; YOLO without `coffer` entry) keep working with unchanged effective thresholds. Tests `test_legacy_embedding_loads_with_legacy_thresholds`, `test_legacy_detection_reads_train_imgsz` (Task 2).
4. Uploading a model the service cannot load — the previously live file stays untouched. Test `RejectedModelKeepsThePreviousFile` (Task 3).
5. Restarting the service after the cosine migration — migration is idempotent and keeps ids, vectors and metadata. Test `test_migration_runs_once_and_keeps_everything` (Task 1).

---

### Task 1: Cosine similarity end to end (service, fix 1)

**Files:**
- Create: `src/Coffer/Coffer.PythonService/vector_store.py`, `tests/test_vector_store.py`
- Modify: `app.py` (lifespan), `build_image_check_response.py`, `pending.py`, `config.py`

**Interfaces:**
- Produces: `open_cosine_collection(client, name: str) -> Collection`; `similarity_from_distance(d: float) -> float` (= 1 − d); `build_image_check_response(results, vector_db_collection, thresholds: dict, save_path, metadata_filters)`; `pending_similars(collection, collection_id, folder, ids, thresholds: dict)`; `config.LEGACY_THRESHOLDS = {"found": 0.975, "similar": 0.925}`.

- [ ] **Step 1: Failing tests** (real `chromadb.EphemeralClient()`):
  - `test_new_collection_is_cosine`: `open_cosine_collection(c, "x").configuration["hnsw"]["space"] == "cosine"`.
  - `test_migration_runs_once_and_keeps_everything`: create `"x"` with default space, add 3 unit vectors with ids/metadata; `open_cosine_collection` → space cosine, same 3 ids, `get(include=["embeddings","metadatas"])` equal (vectors to 1e-6); calling it again changes nothing.
  - `test_identical_vectors_have_similarity_one` and `test_orthogonal_vectors_have_similarity_zero` via a query.
  - In `test_pending.py`: matches now use `thresholds={"found": 0.9, "similar": 0.8}` and a FakeCollection distance 0.05 → `found`.
- [ ] **Step 2: Run** service tests → FAIL (module missing / signature).
- [ ] **Step 3: Implement.** Migration: `get(include=["embeddings","metadatas"])` → `delete_collection` → `create_collection(name, configuration={"hnsw": {"space": "cosine"}})` → `add` in batches of 500. `app.py` lifespan uses `open_cosine_collection`. In-photo merge compares true cosine with `thresholds["found"]`. Remove `SIMILARITY_THRESHOLD` use from both modules (Task 2 supplies per-model thresholds; until then pass `LEGACY_THRESHOLDS`).
- [ ] **Step 4: Run** service tests → PASS.
- [ ] **Step 5: Commit** `fix(ai): cosine similarity in the vector store`

### Task 2: Self-describing models, cache, BGR, validate endpoint (service, fixes 2 and 6)

**Files:**
- Create: `src/Coffer/Coffer.PythonService/coffer_models.py`, `model_cache.py`, `tests/test_coffer_models.py`
- Modify: `app.py` (image_check, pending route, new validate route), `object_detection_similarity_pipeline.py`, `crop_objects_from_image.py`, `image_to_cnn_embedding.py` (becomes a thin wrapper or is removed), `initialize.py` (removed; callers use the cache)

**Interfaces:**
- Produces (`coffer_models.py`, copied byte-identically into the Manager in Task 4):
  - `EMBEDDING_FORMAT = "coffer.embedding.v1"`, `DETECTION_FORMAT = "coffer.detection.v1"`, `LEGACY_THRESHOLDS`, `LEGACY_CONFIDENCE = 0.9`, `BACKBONES = ("resnet18", "resnet50")`
  - `class EmbeddingNet(nn.Module): __init__(self, backbone: str, embedding_dim: int, pretrained: bool = False)`; `forward(x) -> Tensor` (L2-normalised, shape `(B, embedding_dim)`); attributes `backbone` (torchvision ResNet, `fc = Identity`), `head` (`Linear(feat, 512) → ReLU → Linear(512, embedding_dim)`).
  - `save_embedding_model(path: str, net: EmbeddingNet, *, backbone: str, embedding_dim: int, image_size: int, thresholds: dict, classes: list[str], run_id: str) -> None` (mean/std = ImageNet).
  - `@dataclass EmbeddingModel(net, image_size: int, mean, std, thresholds: dict, meta: dict)` with `embed(rgb: np.ndarray) -> np.ndarray` (float32, unit length) and `embed_many(list[np.ndarray]) -> np.ndarray`.
  - `load_embedding_model(path: str, device: str = "cpu") -> EmbeddingModel` — new format, or legacy raw state dict → the legacy ResNet18 + 256-d head + classifier (class count from `classifier.weight`), 224 px, `LEGACY_THRESHOLDS`.
  - `@dataclass DetectionModel(yolo, imgsz: int, confidence: float, meta: dict)` with `detect(rgb: np.ndarray) -> list[tuple[int, int, int, int, float]]` — converts RGB → BGR, predicts at `imgsz` / `confidence`.
  - `load_detection_model(path: str) -> DetectionModel` — `coffer` entry, else legacy (`train_args["imgsz"]`, `LEGACY_CONFIDENCE`).
  - `add_detection_metadata(path: str, *, imgsz: int, confidence: float, run_id: str) -> None`.
- Produces (`model_cache.py`): `class ModelCache(loaders=None)` with `embedding(path) -> EmbeddingModel`, `detection(path) -> DetectionModel`; cache key `(abspath, st_mtime_ns, st_size)`.
- Produces (route): `POST /models/validate` body `{"fileName": str, "kind": "detection" | "embedding"}`; `fileName` must match `^[0-9]+_(detection|similarity_[0-9]+)\.pt(\.candidate)?$` and is read from `MODELS_PATH`; loads it and runs one 64×64 black image; `200 {"status":"ok"}` or `422 {"status":"error","message":...}`.
- Produces (route): `POST /pending_similars/{collection_id}?type_id=N` — thresholds from that type's embedding model, `LEGACY_THRESHOLDS` when absent.

- [ ] **Step 1: Failing tests** (`tests/test_coffer_models.py`, CPU, `pretrained=False`):
  - `test_new_embedding_roundtrip`: save → load → `meta["format"] == "coffer.embedding.v1"`, thresholds and image_size kept, `embed` of a random 50×40 RGB array returns a unit vector of length `embedding_dim`, identical to the saved net's output (1e-5).
  - `test_legacy_embedding_loads_with_legacy_thresholds`: a raw state dict of the legacy net (classifier 60) loads; thresholds == `LEGACY_THRESHOLDS`; embedding length 256.
  - `test_resnet50_model_loads` (the Manager's old mismatch can no longer happen).
  - `test_detection_receives_bgr`: a fake `yolo.predict` records its `source`; `detect(rgb)` passes `rgb[..., ::-1]`, `imgsz` and `conf` from metadata.
  - `test_legacy_detection_reads_train_imgsz`: checkpoint dict with `train_args {"imgsz": 640}` and no `coffer` → imgsz 640, confidence 0.9 (fake YOLO constructor injected).
  - `test_cache_reuses_until_file_changes`: counting loader; two gets → 1 load; touch file with new mtime → 2 loads.
  - `test_validate_accepts_good_and_rejects_bad` (TestClient, temp `MODELS_PATH`): good embedding file → 200; random bytes → 422; `../x.pt` → 422.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** and switch `image_check` / pending to `ModelCache` (module-level instance), thresholds from the embedding model. Delete `initialize.py` and the duplicate model class in `image_to_cnn_embedding.py`.
- [ ] **Step 4: Run** all service tests → PASS.
- [ ] **Step 5: Commit** `fix(ai): self-describing models, cached, BGR to YOLO, validate endpoint`

### Task 3: Backend — validated uploads, model download, pending type id

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/ItemTypes/ModelValidator.cs`, `src/Coffer/Coffer.Tests/ItemTypes/ModelValidationTests.cs`
- Modify: `ItemTypeFiles.cs`, `ItemTypeAdminService.cs`, `ItemTypeAdminControllers.cs`, `PendingItemService.cs`, `ModerationRegistration.cs`, `Coffer.Tests/ApiFactory.cs`, app `errors.json` en/hu (generated + Hungarian)

**Interfaces:**
- Produces: `public sealed record ModelValidation(bool Ok, string? Message);` `public interface IModelValidator { Task<ModelValidation> ValidateAsync(string fileName, string kind, CancellationToken ct = default); }`; `HttpModelValidator` (typed HttpClient, `POST {FASTAPI_URL}/models/validate`, timeout 2 min; unreachable service → `Ok=false`).
- `IItemTypeFiles.SaveModelsAsync(int typeId, IFormFile? detection, IFormFile? embedding, int? classCount, IModelValidator validator)` — writes each file to `<final>.candidate`, validates every candidate, then moves all into place (overwrite) and deletes older embeddings; on any failure deletes the candidates and throws `Validation("modelInvalid", "The AI service could not load this model file.")`.
- `IItemTypeFiles.ModelPath(int typeId, string kind) -> string?`; route `GET api/Admin/ItemTypes/{id:int}/Models/{kind}` (`detection` | `embedding`) → file (`application/octet-stream`) or 404 `modelNotFound`.
- Pending: `pending_similars/{collectionId}?type_id={collectionTypeId}`.
- `ApiFactory` registers an accepting fake validator by default.

- [ ] **Step 1: Failing tests**: `RejectedModelIsNotPublished` (fake validator Ok=false → 400 `modelInvalid`, no `.pt`, no `.candidate` left); `RejectedModelKeepsThePreviousFile` (upload A ok, then B rejected → file bytes still A); `AcceptedModelReplacesTheOld`; `ValidatorSeesCandidateNames` (fake records `"{id}_detection.pt.candidate"`, `"embedding"` kind for `"{id}_similarity_60.pt.candidate"`); `ModelDownloadIsAdminOnly` (401/401/403 as in the other admin tests) and `ModelDownloadServesTheFile` / 404 `modelNotFound`.
- [ ] **Step 2: Run** `--filter FullyQualifiedName~ModelValidation` → FAIL.
- [ ] **Step 3: Implement**; `npm run gen:errors`, Hungarian texts for `modelInvalid`, `modelNotFound`.
- [ ] **Step 4: Run** full backend suite + `npm run check:errors` → PASS.
- [ ] **Step 5: Commit** `feat(api): validate uploaded AI models, download live models`

### Task 4: Manager training core — config, data checks, runs, metrics, report

**Files:**
- Create in `src/Coffer/Coffer.Manager/training/`: `__init__.py`, `coffer_models.py` (copy of the service's), `config.py`, `datasets.py`, `runs.py`, `metrics.py`, `report.py`, `test_training_core.py`

**Interfaces:**
- `config.py`: `@dataclass DetectionConfig(name, train_dir, test_dir, compare_type_id: int | None = None, base_model="yolov8n.pt", epochs=100, imgsz=640, batch=16, patience=30, freeze=0, lr0=0.01, degrees=15.0, scale=0.5, translate=0.1, fliplr=0.5, mosaic=1.0, hsv_h=0.015, hsv_s=0.7, hsv_v=0.4, val_fraction=0.15, seed=0)`; `@dataclass EmbeddingConfig(name, train_dir, test_dir, compare_type_id=None, backbone="resnet18", pretrained=True, embedding_dim=256, image_size=224, frozen_stages=2, epochs=40, classes_per_batch=8, images_per_class=4, lr=3e-4, loss="triplet" | "subcenter_arcface", val_fraction=0.15, patience=8, perspective=0.2, brightness=0.3, contrast=0.3, saturation=0.2, hue=0.0, blur_p=0.2, erasing_p=0.25, seed=0)`; `validate(cfg) -> list[str]`; `save(cfg, path)`, `load(path) -> DetectionConfig | EmbeddingConfig` (`kind` key in JSON).
- `datasets.py`: `class DatasetError(Exception)` (`.messages: list[str]`); `sha1(path) -> str`; `class_folders(root) -> dict[str, list[str]]` (images `.jpg .jpeg .png .webp .bmp`); `yolo_export(root) -> list[tuple[image, label]]` (+ class name from `classes.txt`); `check_embedding(train_dir, test_dir) -> EmbeddingData(train: dict, test: dict, warnings: list[str], manifest: dict)`; `check_detection(train_dir, test_dir) -> DetectionData(train: list, test: list, class_name: str, warnings, manifest)`; `split_classes(classes, fraction, seed) -> (train, val)`; `split_by_session(images, fraction, seed) -> (train, val)` (session = files whose `YYYYMMDDHHMMSS` name stamps are ≤ 10 min apart; files without a stamp are their own session).
- `runs.py`: `PHASES = ("checking", "training", "evaluating", "done", "failed", "stopped")`; `create_run(runs_root, cfg) -> str` (folder `%Y%m%d-%H%M%S_{kind}_{slug}`); `write_progress(run_dir, phase, **fields)`; `read_progress(run_dir) -> dict`; `log(run_dir, message)`; `list_runs(runs_root) -> list[dict]` (newest first: id, kind, name, phase, created, headline).
- `metrics.py`: `retrieval_metrics(emb: np.ndarray, labels: list) -> dict` (`r1, r5, r10, map_at_r, queries`); `pair_scores(emb, labels) -> (genuine, impostor)`; `threshold_at_fmr(impostor, fmr) -> float`; `recommended_thresholds(genuine, impostor) -> {"found", "similar", "found_recall", "similar_recall"}` (found at 0.01, similar at 0.05); `pick_confidence(conf_axis, f1_curve, cap=0.9) -> float`; `compare(new: dict, live: dict | None, keys: list[str]) -> list[dict]` (`metric, live, new, delta`).
- `report.py`: `write_report(run_dir, kind, new: dict, live: dict | None, test_size: dict, thresholds: dict) -> dict` → `report.json`, `report.md`.

- [ ] **Step 1: Failing tests** (`test_training_core.py`), with temp folders of tiny generated images:
  - `test_coffer_models_is_identical_to_the_service_copy` (byte compare with `../Coffer.PythonService/coffer_models.py`).
  - `test_config_rejects_hue_above_002_and_bad_batch` (`validate` messages), `test_config_roundtrip`.
  - `test_embedding_test_overlap_by_content_is_refused` (same bytes, different name → `DatasetError` mentioning both paths).
  - `test_embedding_test_class_name_overlap_is_refused`, `test_class_with_one_image_is_refused`, `test_class_with_three_images_warns`.
  - `test_detection_requires_single_class_and_labels` (two classes in `classes.txt` → error; image without label file → error; empty label file = background image, allowed).
  - `test_split_by_session_keeps_sessions_together` (`IMG20251009173435` and `IMG20251009173456` land in the same split).
  - `test_retrieval_metrics_known_case` (4 vectors, 2 classes, hand-computed R@1 = 1.0 / 0.5 cases, mAP@R).
  - `test_threshold_at_fmr` (impostors `[0.1..1.0]` step 0.1, fmr 0.1 → only 0.9+ pass at most 10%) and `test_pick_confidence_capped_at_09`.
  - `test_compare_marks_delta_and_missing_live`.
  - `test_run_folder_and_progress` (create, write/read progress, list order).
- [ ] **Step 2: Run** Manager tests → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(manager): training core — configs, data checks, runs, metrics`

### Task 5: Embedding training and evaluation (fixes 4 and 5)

**Files:**
- Create: `training/embedding_train.py`, `training/embedding_eval.py`, `training/worker.py`, `training/test_embedding_worker.py`

**Interfaces:**
- Consumes: Task 2 `coffer_models` (Manager copy), Task 4 modules.
- `build_train_transform(cfg: EmbeddingConfig)` — `RandomRotation(180, fill=…)` (fill = mean colour), `RandomPerspective(cfg.perspective)`, `RandomResizedCrop(image_size, scale=(0.6, 1.0), ratio=(0.9, 1.1))`, `ColorJitter(cfg.brightness, cfg.contrast, cfg.saturation, cfg.hue)`, blur (p `blur_p`), `ToTensor`, ImageNet normalise, `RandomErasing(p=erasing_p, scale=(0.02, 0.15))`. No flip transforms.
- `train_embedding(run_dir, cfg, data: EmbeddingData, device: str, stop_file: str) -> str` (path of `embedding.pt`): `EmbeddingNet(cfg.backbone, cfg.embedding_dim, cfg.pretrained)`, first `frozen_stages` of (`conv1+bn1`, `layer1`, `layer2`, `layer3`) frozen and kept in eval mode; `MPerClassSampler(m=images_per_class, batch_size=classes_per_batch*images_per_class)`; loss `TripletMarginLoss(margin=0.2)` with `BatchHardMiner`, or `SubCenterArcFaceLoss(num_classes, embedding_dim, sub_centers=3)` + 0.5 × that triplet; AdamW (backbone lr × 0.1, head lr); `CosineAnnealingLR(T_max=epochs)` with `scheduler.step()` once per epoch; each epoch: validation R@1 on the held-out classes, `metrics.csv` row, progress; keep best by val R@1, early stop after `patience` epochs; stop when `stop_file` exists; seeded.
- `evaluate_embedding(model_path: str, test: dict[str, list[str]], device) -> dict` → `retrieval_metrics` + `pair_scores` stats + `recommended_thresholds`.
- `worker.main(argv)`: `python -m training.worker <run_dir>`; phases checking → training → evaluating → done; any exception → `failed` with the message in progress and log; evaluates `live_embedding.pt` / `live_detection.pt` in the run folder when present; writes the recommended thresholds into the saved model (`save_embedding_model` / `add_detection_metadata`) before `done`.

- [ ] **Step 1: Failing tests** (CPU, generated data: 8 classes × 4 coloured-pattern images 64 px, test 3 unseen classes × 3):
  - `test_train_transform_has_no_flips_and_small_hue` (no `RandomHorizontalFlip`/`RandomVerticalFlip` in the pipeline; ColorJitter hue ≤ 0.02).
  - `test_scheduler_anneals_per_epoch` (`lr` after each epoch strictly decreasing for 3 epochs).
  - `test_embedding_worker_end_to_end` (config `pretrained=False`, epochs 2, image_size 64): progress `done`; `embedding.pt` loads with `load_embedding_model`, `meta["classes"]` = training classes minus validation classes, thresholds present; `report.json` has `new.r1`, `live` null with note; `metrics.csv` 2 rows.
  - `test_worker_compares_with_live_model` (a saved model copied as `live_embedding.pt` → report has both columns and deltas).
  - `test_overlapping_test_set_fails_in_checking` (phase `failed`, message names the overlap, no model file).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** Manager tests → PASS.
- [ ] **Step 5: Commit** `feat(manager): embedding training with identity-preserving augmentation and test-set report`

### Task 6: Detection training and evaluation

**Files:**
- Create: `training/detection_train.py`, `training/detection_eval.py`, `training/test_detection_worker.py`
- Modify: `training/worker.py` (detection branch)

**Interfaces:**
- `write_yolo_dataset(run_dir, train: list, val: list, class_name: str) -> str` (writes `data/train.txt`, `data/val.txt` with absolute image paths and `data/data.yaml`; returns the yaml path).
- `ultralytics_args(cfg: DetectionConfig, data_yaml: str, run_dir: str, device: str) -> dict` (maps every config field; `project=run_dir`, `name="yolo"`, `exist_ok=True`, `plots=False`, `seed=cfg.seed`).
- `train_detection(run_dir, cfg, data: DetectionData, device, stop_file) -> str` (copies `best.pt` to `run_dir/detection.pt`; a callback on epoch end checks `stop_file` and sets the trainer's stop flag; writes progress per epoch).
- `evaluate_detection(model_path, test: list, class_name, device) -> dict` (`model.val` on a test yaml; `precision, recall, f1, map50, map50_95, confidence` via `pick_confidence` on `metrics.box.px` / F1 curve).

- [ ] **Step 1: Failing tests**: `test_ultralytics_args_maps_config` (every field, `plots=False`); `test_yolo_dataset_lists_absolute_paths`; `test_detection_worker_end_to_end` (CPU, `base_model="yolov8n.yaml"` (no download), 8 generated 96 px images with a circle and its label, 3 test images, epochs 1, imgsz 64) → `done`, `detection.pt` has `coffer` with `imgsz` 64 and `confidence` ≤ 0.9, report present.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(manager): detection training with test-set report`

### Task 7: Model training view, deploy, API (replaces Similarity Check Training)

**Files:**
- Create: `training/view.py`, `training/test_view.py`
- Modify: `reports/api.py` (`download_model`), `initialize.py` (`("Model training", ModelTrainingView)` replaces the old entry), `reports/test_reports.py` or `training/test_view.py` (API test)
- Delete: `similarity_check_training/` (the crop tool moves into the view as "Crop photos with the live detector…", using `coffer_models.load_detection_model`; the Chroma debug tools are dropped — the service owns the collection)

**Interfaces:**
- `AdminApi.download_model(type_id: int, kind: str, dest_path: str) -> bool` (`GET /api/Admin/ItemTypes/{id}/Models/{kind}`; False on 404).
- `class ModelTrainingView(_AdminView)`: tabs Detection / Embedding (settings form bound to the config dataclass, folder pickers for training and test data, item type to compare with), runs list (name, kind, phase, headline metric, date), progress bar + live log tail, Start / Stop / Open report / "Use for item type…"; runs root chosen once (stored in `Coffer.Manager/.env` as `COFFER_RUNS_DIR`, default `%USERPROFILE%\CofferRuns`); shows device (CUDA name or CPU). Detection base model choices: `yolov8n.pt`, `yolov8s.pt`, `yolo11n.pt`, `yolo11s.pt`, and "Live model of the compare type" (uses the downloaded `live_detection.pt` as `base_model`).
- Start: `validate(cfg)` → `create_run` → download the live model of the compare type into the run folder → `subprocess.Popen([sys.executable, "-m", "training.worker", run_dir], cwd=<Manager dir>)`; Stop: create `run_dir/STOP`, then terminate after 30 s; a dead process whose progress isn't `done`/`failed` becomes `stopped`.
- Deploy ("Use for item type…", only for `done` runs): `upload_models(type_id, detection_path=…)` or `upload_models(type_id, embedding_path=…, class_count=len(meta["classes"]))`.

- [ ] **Step 1: Failing tests** (Tk root, fake API / fake process): `test_start_writes_run_and_launches_worker` (Popen args), `test_start_refuses_invalid_config` (message shown, nothing launched), `test_stopped_run_offers_no_deploy`, `test_deploy_embedding_sends_class_count`, `test_download_model_route_and_404` (FakeSession).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** Manager tests → PASS; scripted smoke of the view against a fake API (scratchpad, like the News tab).
- [ ] **Step 5: Commit** `feat(manager): Model training view`

### Task 8: CUDA PyTorch, data fix, real runs and device check (fix 3)

- [ ] **Step 1:** In the Manager venv: `pip install --force-reinstall torch==2.8.0+cu126 torchvision==0.23.0+cu126 --index-url https://download.pytorch.org/whl/cu126`. Verify: `torch.cuda.is_available()` True, `"sm_61" in torch.cuda.get_arch_list()`, a 1024×1024 matmul on `cuda`. Update `requirements.txt` (it is UTF-16 LE with BOM — keep the encoding).
- [ ] **Step 2: Data fix** — move `szakdolgozat/training/ObjectSimilarity/Processed/cap36`…`cap60` to `…/ObjectSimilarity/Excluded/brand-level/` (move, never delete); confirm 35 classes / 175 crops remain.
- [ ] **Step 3: Verification split** (only to prove the tool; labelled as such in the report name): embedding test = `cap31`–`cap35` copied to a temporary test folder and absent from a temporary training copy; detection = pseudo-labelled `NeedsProcessing` photos (current detector, conf 0.5) split by day into train / test. Train both kinds on the GPU from the view; check progress, stop/resume behaviour, report deltas against the live models of item type 1.
- [ ] **Step 4:** Deploy the embedding run to a test item type (not type 1), confirm the backend accepts it (validation), the service reloads it without a restart, and an image check in the app returns results.
- [ ] **Step 5:** Fix what the check finds (failing test first where testable); run all three suites; commit.
