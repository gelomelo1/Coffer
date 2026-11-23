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
"""

HELP = {"embedding": EMBEDDING, "detection": DETECTION}
