import type { ConfigContext, ExpoConfig } from "expo/config";

// Read from Coffer.ReactNative/.env (Expo loads it before this file runs). A build without them must not happen.
function required(name: "EXPO_PUBLIC_AUTH_SCHEME" | "EXPO_PUBLIC_FACEBOOK_APP_ID"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in Coffer.ReactNative/.env`);
  return value;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const scheme = required("EXPO_PUBLIC_AUTH_SCHEME");
  // Facebook Login sends the browser back to fb{app id}://authorize.
  const facebookScheme = `fb${required("EXPO_PUBLIC_FACEBOOK_APP_ID")}`;

  return {
    ...config,
    name: "Coffer.ReactNative",
    slug: "coffer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.gelomelo.coffer",
      intentFilters: [
        {
          action: "VIEW",
          data: [{ scheme }, { scheme: facebookScheme }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android_icon_foreground.png",
        backgroundImage: "./assets/images/android_icon_background.png",
        monochromeImage: "./assets/images/android_icon_monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash_icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      [
        "expo-asset",
        {
          assets: ["./assets/images/android_icon_foreground.png", "./assets/images/icon.png"],
        },
      ],
      "expo-font",
      "react-native-navigation-mode",
      ["expo-image-picker"],
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission: "Allow Coffer to use the camera to scan the handoff QR code at a marketplace meetup.",
          recordAudioAndroid: false,
        },
      ],
      // HTTPS only; debug builds may use plain HTTP to the emulator's host (dev server and local API) and nothing else.
      "./plugins/with_network_security.js",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "007245ec-3e87-420e-87da-743a5be7a593",
      },
    },
    owner: "gelomelo",
  };
};
