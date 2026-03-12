import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect } from "react";

interface CustomImageResizeProps {
  width: number;
  compress: number;
  asset: ImagePicker.ImagePickerAsset;
  setAsset: (asset: ImagePicker.ImagePickerAsset) => void;
  onComplete?: () => void;
}

function CustomImageResize({
  width,
  compress,
  asset,
  setAsset,
  onComplete,
}: CustomImageResizeProps) {
  const imageManipulatorContext = ImageManipulator.useImageManipulator(
    asset.uri,
  );

  useEffect(() => {
    const resizeImage = async () => {
      try {
        if (asset.width && asset.width <= width) return;

        imageManipulatorContext.resize({ width: width });

        const rendered = await imageManipulatorContext.renderAsync();

        const resized = await rendered.saveAsync({
          compress: compress,
          format: ImageManipulator.SaveFormat.JPEG,
        });

        setAsset({
          ...asset,
          uri: resized.uri,
          mimeType: "image/jpeg",
          fileName: asset.fileName ?? "upload.jpg",
        });
      } catch (error) {
        console.error("Image resize failed", error);
      } finally {
        onComplete?.();
      }
    };

    resizeImage();
  }, []);

  return null;
}

export default CustomImageResize;
