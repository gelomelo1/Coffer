"""Test-set metrics and recommended thresholds."""
import math

import numpy as np


def retrieval_metrics(emb: np.ndarray, labels: list) -> dict:
    """Leave-one-out retrieval over unit vectors: each image queries all the others.
    r1 / r5 / r10 = share of queries with a same-class image among the top k; map_at_r = MAP@R
    (Musgrave et al. 2020). Queries without another image of their class are skipped."""
    emb = np.asarray(emb, dtype=np.float32)
    labels = np.asarray(labels)
    sims = emb @ emb.T
    np.fill_diagonal(sims, -np.inf)
    hits = {1: 0, 5: 0, 10: 0}
    average_precisions = []
    for q in range(len(emb)):
        relevant = labels == labels[q]
        relevant[q] = False
        r = int(relevant.sum())
        if r == 0:
            continue
        order = np.argsort(-sims[q], kind="stable")
        rel = relevant[order]
        for k in hits:
            hits[k] += bool(rel[:k].any())
        top = rel[:r]
        precision_at = np.cumsum(top) / np.arange(1, r + 1)
        average_precisions.append(float((precision_at * top).sum() / r))
    n = len(average_precisions)
    if n == 0:
        return {"r1": 0.0, "r5": 0.0, "r10": 0.0, "map_at_r": 0.0, "queries": 0}
    return {"r1": hits[1] / n, "r5": hits[5] / n, "r10": hits[10] / n,
            "map_at_r": float(np.mean(average_precisions)), "queries": n}


def pair_scores(emb: np.ndarray, labels: list):
    """(genuine, impostor) cosine similarities of every pair of images."""
    emb = np.asarray(emb, dtype=np.float32)
    labels = np.asarray(labels)
    sims = emb @ emb.T
    i, j = np.triu_indices(len(emb), k=1)
    same = labels[i] == labels[j]
    return sims[i, j][same], sims[i, j][~same]


MIN_FOUND = 0.6
MIN_SIMILAR = 0.5


def top_impostor_scores(emb: np.ndarray, labels: list) -> np.ndarray:
    """For each image, its similarity to the closest image of another cap: what a photo of a cap that is NOT in a
    collection would score against that collection's best (wrong) match."""
    emb = np.asarray(emb, dtype=np.float32)
    labels = np.asarray(labels)
    sims = emb @ emb.T
    sims[labels[:, None] == labels[None, :]] = -np.inf
    top = sims.max(axis=1)
    return top[np.isfinite(top)]


def threshold_at_fmr(impostor: np.ndarray, fmr: float) -> float:
    """The lowest cosine at which at most `fmr` of impostor pairs (different caps) would count as a match."""
    impostor = np.sort(np.asarray(impostor, dtype=np.float64))[::-1]
    if len(impostor) == 0:
        return 1.0
    allowed = int(np.floor(fmr * len(impostor)))
    if allowed >= len(impostor):
        return float(impostor[-1])
    return float(min(1.0, impostor[allowed] + 1e-6))


def recommended_thresholds(genuine: np.ndarray, top_impostor: np.ndarray) -> dict:
    """Per query, as the app works: a photo is compared with a whole collection and its best match decides.
    found: at most 2% of photos of caps NOT in the collection would still be "found" (their closest other cap is
    above it); similar: at most 10%. Never below MIN_FOUND / MIN_SIMILAR (small test sets are noisy).
    found_recall / similar_recall: share of same-cap pairs that reach each threshold."""
    top_impostor = np.asarray(top_impostor, dtype=np.float64)
    found = max(MIN_FOUND, threshold_at_fmr(top_impostor, 0.02))
    similar = max(MIN_SIMILAR, min(found, threshold_at_fmr(top_impostor, 0.10)))
    genuine = np.asarray(genuine)
    recall = (lambda t: float(np.mean(genuine >= t)) if len(genuine) else 0.0)
    # Rounded up, never down: rounding down could let in the impostor score the threshold was set to exclude.
    found, similar = math.ceil(found * 1e4) / 1e4, math.ceil(similar * 1e4) / 1e4
    return {"found": found, "similar": similar, "found_recall": recall(found),
            "similar_recall": recall(similar),
            "false_found": float(np.mean(top_impostor >= found)) if len(top_impostor) else 0.0}


def pick_confidence(conf_axis, f1_curve, cap: float = 0.9) -> float:
    """Detection confidence with the best F1 on the test set, never above `cap`."""
    conf_axis = np.asarray(conf_axis, dtype=np.float64)
    f1_curve = np.asarray(f1_curve, dtype=np.float64)
    allowed = conf_axis <= cap + 1e-9
    if not allowed.any():
        return cap
    best = np.argmax(np.where(allowed, f1_curve, -np.inf))
    return round(float(conf_axis[best]), 3)


def compare(new: dict, live, keys: list) -> list:
    """Rows {metric, live, new, delta} for the report; live / delta are None without a live model or value."""
    rows = []
    for key in keys:
        value = new.get(key)
        old = live.get(key) if live else None
        delta = (value - old) if (value is not None and old is not None) else None
        rows.append({"metric": key, "live": old, "new": value, "delta": delta})
    return rows
