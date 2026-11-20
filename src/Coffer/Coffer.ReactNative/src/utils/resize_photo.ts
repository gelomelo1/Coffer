import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ImagePickerAsset } from "expo-image-picker";
import { highImageResize } from "../const/image_resize_config";

/** Shrinks a photo before the AI check (same size as the single-photo flow used). Falls back to the original. */
export async function resizeForUpload(asset: ImagePickerAsset): Promise<ImagePickerAsset> {
  if (asset.width && asset.width <= highImageResize.width) return asset;
  try {
    const rendered = await ImageManipulator.manipulate(asset.uri).resize({ width: highImageResize.width }).renderAsync();
    const saved = await rendered.saveAsync({ compress: highImageResize.compress, format: SaveFormat.JPEG });
    return { ...asset, uri: saved.uri, width: saved.width, height: saved.height, mimeType: "image/jpeg", fileName: asset.fileName ?? "upload.jpg" };
  } catch {
    return asset;
  }
}
