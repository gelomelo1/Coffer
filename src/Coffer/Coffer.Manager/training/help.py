"""The "How to prepare the data" help of the Model training tabs."""

EMBEDDING = """\
EMBEDDING MODEL — how to prepare the data

The embedding model learns what makes one cap different from another, so it can recognise a cap again from a new
photo. In the app almost every cap is one the model never saw in training (users own caps you never photographed),
so the test set must contain DIFFERENT caps from the training data — not the same caps with new photos. The trainer
refuses a test folder whose name is also a training folder, and any photo that appears in both.

1. Sort the raw photos: one folder per cap variant. The folder name is the class.
       raw/cap001/   5–10 photos of the same cap
       raw/cap002/   ...
   Take the photos of one cap on different days, on different backgrounds and in different light (and if you can,
   with more than one phone). Different variants of a brand (another colour, another text) are different caps:
   give each its own folder.

2. Crop the caps out of the photos: "Crop photos with the live detector…".
       input:  raw/        output: cropped/
   The same folder structure comes out, one picture per detected cap ("<photo>_1.jpg"). Look through the crops and
   delete anything that is not the cap (a coin, a lid…).

3. Split by CAP, not by photo — move whole folders:
       train/   cap001 … cap250    most caps
       test/    cap251 … cap300    about 50 other caps, never in train/
   Every training cap needs at least 2 photos (4 or more is much better); at least 5 training caps in total.
   Every test cap needs at least 2 photos, ideally 4–6 from different days.

4. On this tab: Training data = train/, Test set = test/, Compare with item type = the type whose live model you
   want to beat. Adjust the settings if you like, then Start training.

What happens next
- The trainer sets aside about 15% of the training caps (at least 2) to decide when to stop; you don't do anything.
- When training ends, every test photo is used as a query against the other test photos: finding another photo of
  the same cap is a hit. This is how a collection works in the app — the cap is already in it, a new photo of it
  arrives. The report shows Recall@1/5/10 and MAP@R for the new model and the live one, side by side.
- "found" / "similar" thresholds are chosen on the test set so that at most 2% / 10% of photos of caps that are
  NOT in a collection would still be reported as found / similar, and are saved inside the model.
- If the new model is better, select the run and press "Use for item type…": the model goes live and every stored
  fingerprint of that item type is rebuilt with it.

SETTINGS — what they do and when to change them
The defaults are research-based starting points, not tuned on your data. Find better ones by changing ONE setting
per run, keeping the same test set, and comparing the reports. With 50 test photos one photo is 0.02 of a score.

Training
- Backbone (default resnet18): the pretrained network that turns a photo into numbers. resnet50 is bigger and
  slower; on our cap photos the untrained resnet18 already did better (87% vs 75% Recall@1), so try resnet50 only
  with several hundred caps.
- Start from ImageNet weights (on): begins from a network that already knows shapes, colours and textures. Leave
  it on; switching it off needs thousands of caps.
- Image size (default 224 px): the size crops are resized to. 288–320 can keep small print readable but trains
  slower; it helps when caps differ only in small text.
- Frozen backbone stages (default 2 of 4): the first stages are not trained, so they keep their general knowledge.
  More frozen (3) = less memorising of the training caps: use it with fewer than ~300 caps. Fewer frozen (1, 0)
  = the network adapts more: use it with 500+ caps.
- Epochs (default 40, at most): how many times training goes through all photos. The run stops earlier on its own
  (see the next setting), so raise this only if the log shows the best epoch near the end.
- Stop after epochs without improvement (default 8): early stopping on the held-out validation caps. Raise it to
  12–15 if the best epoch comes early while the loss is still falling; lower it to save time.
- Caps per batch (default 8): how many different caps the model compares at once. More caps = harder, more useful
  comparisons; limited by GPU memory and by how many training caps you have.
- Photos per cap in a batch (default 4): photos of the same cap in each batch. Keep it at most your typical number
  of photos per cap (4 suits 5-photo folders); more teaches more about how one cap can look.
- Learning rate (default 0.0003; the backbone uses a tenth of it): how big the training steps are. Too high and
  the validation score jumps around or falls; too low and nothing improves. Try 0.0001 if scores are unstable.
- Loss (default triplet): how the model is told what is right. triplet pulls photos of the same cap together and
  pushes other caps away — robust with few caps. subcenter_arcface learns a centre per cap and separates caps
  more sharply; it needs more caps (try it from about 100 caps).
- Validation share of training caps (default 0.15, at least 2 caps): caps held out of training to choose the best
  epoch. More = a more reliable choice but less to train on.
- Seed (default 0): makes a run repeatable. Change it to see how much a result is luck: if two seeds differ by
  as much as two settings do, the difference between the settings is not real.

Augmentation (random changes to training photos, so the model learns what does NOT change a cap)
- Rotation is always on: caps are round, every rotation is a real photo of the same cap.
- Flips are never used: a mirrored cap (mirrored text) is not the same cap.
- Perspective (default 0.2): tilts the photo as if taken at an angle. Raise towards 0.3–0.4 if users photograph
  caps at steep angles; 0 if all photos are straight from above.
- Brightness (default 0.3) and Contrast (default 0.3): lighting changes. Raise them if test photos come from very
  different light (outdoors, flash, dim rooms).
- Saturation (default 0.2): colour strength, as different phones process colour. Keep it moderate: colour is part
  of a cap's identity.
- Hue shift (default 0, at most 0.02): rotates the colours themselves. Keep it at 0 — a green cap turned blue is
  another cap.
- Blur probability (default 0.2): share of photos blurred a little (shaky hands, cheap cameras). Raise it if test
  photos are often unsharp.
- Erasing probability (default 0.25): covers a small random patch (fingers, glare, dirt). Raise it if caps are
  often partly covered; too much hides the logo the model needs.
"""

DETECTION = """\
DETECTION MODEL — how to prepare the data

The detection model finds the caps in a photo and draws a box around each one; the app crops these boxes. Its data
are photos with boxes drawn around every cap, made in Label Studio. The test set is a separate set of DIFFERENT
photos, ideally taken on other days and in other places, so the score says how the model does on new photos. The
trainer refuses any photo that is in both.

1. Take the photos the way users will: different phones, backgrounds, light (daylight, lamp, flash), distances,
   angles, one cap and several caps per photo, caps partly covered by fingers. Add 5–10% photos with NO cap, and
   photos with look-alikes (coins, buttons, jar lids) that must not be detected.

2. Draw the boxes in Label Studio.
   - Create a project with the "Object Detection with Bounding Boxes" template and a single label: cap.
   - Import the photos and draw a box around EVERY cap in every photo (a cap without a box teaches the model to
     ignore caps). A photo with no cap: submit it with no boxes.
   - Make two projects (or two exports): one for training, one for the test photos.

3. Export each project as YOLO ("YOLO with Images" if your Label Studio offers it) and unzip it. Each folder must
   contain:
       images/        the photos
       labels/        one .txt per photo, same name (empty for a photo without caps)
       classes.txt    exactly one line: cap
   Keep the photo file names from the phone (IMG20251009173435.jpg): the time in the name is used to keep photos
   of one sitting together.

4. On this tab: Training data = the training export, Test set = the test export, Compare with item type = the type
   whose live detector you want to beat. Base model: a small pretrained YOLO (yolov8n.pt to start), or "Live model
   of the compare type" to continue from the current detector. Start training.

What happens next
- The trainer sets aside about 15% of the training photos to decide when to stop, keeping photos taken within 10
  minutes of each other together (near-identical shots never sit on both sides). Photograph on several days;
  with one long sitting the log warns that validation is optimistic.
- When training ends, both the new and the live model run on the test photos. The report shows precision, recall,
  F1, mAP50 and mAP50-95 side by side, and the confidence threshold with the best F1 (never above 0.9) is saved
  inside the model.
- If the new model is better, select the run and press "Use for item type…": photo checks of that item type use
  it from the next request.

SETTINGS — what they do and when to change them
The defaults are close to Ultralytics' recommendations plus rotation for round caps; they are starting points, not
tuned on your data. Change ONE setting per run, keep the same test set, and compare the reports.

Training
- Base model (default yolov8n.pt): the pretrained detector to start from. n = nano (fast, small), s = small
  (stronger, about 3x slower); yolo11 is the newer generation. Try yolov8s.pt / yolo11s.pt if the report shows
  missed caps, especially small or distant ones. "Live model of the compare type" continues from the current
  detector — useful when you only add some new photos.
- Epochs (default 100, at most): passes over all training photos. The run stops earlier when validation stops
  improving; raise it if the score was still rising at the last epoch.
- Image size (default 640, multiple of 32): photos are resized to this for training AND in the app. Raise to
  800–960 if photos contain several small caps or caps far away (slower, more GPU memory); 640 is right for
  close-up photos of one or a few caps.
- Batch (default 16): photos per training step. Lower it (8) if the GPU runs out of memory, e.g. with a larger
  image size or model.
- Stop after epochs without improvement (default 30): early stopping on the validation photos.
- Frozen layers (default 0 = none, 10 = backbone): keeps the pretrained feature layers fixed. Freezing the backbone
  (10) helps with few photos (under ~300) and trains faster; with plenty of photos, training everything (0) is
  usually best.
- Learning rate (default 0.01): step size. Lower it (0.002–0.005) when continuing from the live model, so it is
  refined rather than overwritten.
- Validation share (default 0.15, whole sessions): photos held out to choose the best epoch, keeping photos taken
  within 10 minutes together. More = a more reliable choice, less to train on.
- Seed (default 0): makes a run repeatable; change it to see how much of a difference is luck.

Augmentation (random changes to training photos; they make the model robust, the test photos are never changed)
- Rotation (default 15 degrees): turns the whole photo. Caps are round, so 30–45 helps if photos come at odd
  angles; very large values make boxes looser.
- Scale (default 0.5): zooms in and out by up to 50%. Raise it (0.7–0.9) if caps appear at very different sizes,
  e.g. far away in some photos.
- Translate (default 0.1): shifts the photo, so caps also appear near the edges.
- Horizontal flip probability (default 0.5): mirrors photos. Fine for detection — the detector only needs to know
  "this is a cap", not which cap.
- Mosaic (default 1.0): stitches 4 photos into one, teaching small caps and busy scenes. Very useful with few
  photos; it is switched off automatically for the last 10 epochs.
- HSV hue (default 0.015), HSV saturation (default 0.7), HSV value (default 0.4): colour, colour strength and
  brightness changes. Raise value (brightness) for photos in very different light; hue can stay small — colour
  is not what makes a cap a cap here, but changing it much does not help either.
"""

HELP = {"embedding": EMBEDDING, "detection": DETECTION}
