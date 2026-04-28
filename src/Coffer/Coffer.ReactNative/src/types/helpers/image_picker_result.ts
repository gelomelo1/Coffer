import * as ImagePicker from "expo-image-picker";

export type ImageSource = "camera" | "gallery";

export type ImagePickerResult =
  | { status: "success"; assets: ImagePicker.ImagePickerAsset[] }
  | { status: "cancel" }
  | { status: "permission_denied" }
  | { status: "error"; error: unknown };
