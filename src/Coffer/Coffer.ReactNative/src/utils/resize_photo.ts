import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ImagePickerAsset } from "expo-image-picker";
import { highImageResize } from "../const/image_resize_config";

export type ResizeConfig = { width: number; compress: number };

/** The re-encoded photo is a JPEG whatever the original was: its name says so (the server checks the extension). */
const jpegName = (name: string | null | undefined) => (name ? name.replace(/\.[^./]*$/, "") || "upload" : "upload") + ".jpg";

/**
 * Shrinks a photo to the config's width before upload (fast upload, little data). A photo already narrower is sent as
 * it is. Falls back to the original when resizing fails (the server resizes oversized photos itself).
 */
export async function resizeForUpload(asset: ImagePickerAsset, config: ResizeConfig = highImageResize): Promise<ImagePickerAsset> {
  if (asset.width && asset.width <= config.width) return asset;
  try {
    const rendered = await ImageManipulator.manipulate(asset.uri).resize({ width: config.width }).renderAsync();
    const saved = await rendered.saveAsync({ compress: config.compress, format: SaveFormat.JPEG });
    return { ...asset, uri: saved.uri, width: saved.width, height: saved.height, mimeType: "image/jpeg", fileName: jpegName(asset.fileName) };
  } catch {
    return asset;
  }
}
