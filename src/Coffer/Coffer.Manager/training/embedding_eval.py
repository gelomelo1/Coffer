"""An embedding model on the test set: retrieval quality, how far apart same-cap and different-cap pairs are, and
the thresholds that keep wrong matches rare."""
import numpy as np
from PIL import Image

from training.coffer_models import load_embedding_model
from training.metrics import pair_scores, recommended_thresholds, retrieval_metrics


def evaluate_embedding(model_path: str, test: dict, device: str = "cpu") -> dict:
    model = load_embedding_model(model_path, device)
    paths = [p for c in sorted(test) for p in test[c]]
    labels = [c for c in sorted(test) for _ in test[c]]
    vectors = []
    for i in range(0, len(paths), 32):
        images = []
        for p in paths[i:i + 32]:
            with Image.open(p) as img:
                images.append(np.asarray(img.convert("RGB")))
        vectors.append(model.embed_many(images))
    emb = np.concatenate(vectors)
    result = retrieval_metrics(emb, labels)
    genuine, impostor = pair_scores(emb, labels)
    result.update({
        "genuine_mean": float(np.mean(genuine)) if len(genuine) else None,
        "impostor_mean": float(np.mean(impostor)) if len(impostor) else None,
        "impostor_max": float(np.max(impostor)) if len(impostor) else None,
        "thresholds": recommended_thresholds(genuine, impostor),
    })
    return result
