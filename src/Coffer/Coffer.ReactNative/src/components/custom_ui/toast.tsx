import Toast, { ToastType } from "react-native-toast-message";

function showToast(type: ToastType, title: string, description?: string) {
  Toast.show({
    type,
    text1: title,
    text2: description,
    visibilityTime: type === "success" || type === "info" ? 2000 : 4000,
    position: "bottom",
  });
}

export default showToast;
