import os, time, threading
import numpy as np
import cv2

def save_temp_files(
        item,
        path: str
                    ):
    np.save(os.path.join(path, f"{item['id']}.npy"), item["embedding"])
    cv2.imwrite(os.path.join(path, f"{item['id']}.jpg"), cv2.cvtColor(item["image"], cv2.COLOR_RGB2BGR))

    def delete_files():
        time.sleep(600)
        try:
            os.remove(os.path.join(path, f"{item['id']}.npy"))
            os.remove(os.path.join(path, f"{item['id']}.jpg"))
        except FileNotFoundError:
            pass

    threading.Thread(target=delete_files, daemon=True).start()