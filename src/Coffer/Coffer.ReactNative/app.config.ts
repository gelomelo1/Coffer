import type { ConfigContext, ExpoConfig } from "expo/config";

// Read from Coffer.ReactNative/.env (Expo loads it before this file runs).
// Release builds (NODE_ENV=production while bundling, or an EAS "production" profile) need every value. Development may
// leave a sign-in id out (or as a placeholder): its redirect scheme is then left out and that sign-in is off.
const release =
  process.env.NODE_ENV === "production" ||
  process.env.EAS_BUILD_PROFILE === "production";
const placeholder = (value: string) =>
  /change-me/i.test(value) || /^your-/i.test(value);

function required(name: "EXPO_PUBLIC_AUTH_SCHEME"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in Coffer.ReactNative/.env`);
  return value;
}

/** The redirect scheme of a browser sign-in, or null (with a warning) when its id isn't set up in development. */
function signInScheme(
  name: "EXPO_PUBLIC_FACEBOOK_APP_ID" | "EXPO_PUBLIC_DISCORD_APP_ID",
  scheme: (id: string) => string,
): string | null {
  const value = process.env[name]?.trim();
  if (value && !placeholder(value)) return scheme(value);
  if (release)
    throw new Error(
      `${value ? `${name} is still a placeholder` : `Missing ${name}`} in Coffer.ReactNative/.env`,
    );
  console.warn(
    `${name} is not set (or still a placeholder): that sign-in is off in this development build.`,
  );
  return null;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const scheme = required("EXPO_PUBLIC_AUTH_SCHEME");
  // Facebook Login sends the browser back to fb{app id}://authorize, Discord to discord-{application id}:/authorize/callback.
  const facebookScheme = signInScheme(
    "EXPO_PUBLIC_FACEBOOK_APP_ID",
    (id) => `fb${id}`,
  );
  const discordScheme = signInScheme(
    "EXPO_PUBLIC_DISCORD_APP_ID",
    (id) => `discord-${id}`,
  );
  const schemes = [scheme, facebookScheme, discordScheme].filter(
    (s): s is string => s !== null,
  );

  return {
    ...config,
    name: "Coffer",
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
          data: schemes.map((s) => ({ scheme: s })),
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      adaptiveIcon: {
        backgroundColor: "#fefdf0",
        // Padded copies: Android shows only the centre 61% of these layers, masked (the originals fill the canvas).
        foregroundImage: "./assets/images/android_icon_foreground_padded.png",
        monochromeImage: "./assets/images/android_icon_monochrome_padded.png",
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
          // Padded copy: Android 12+ masks the splash icon to a circle of 2/3 its size.
          image: "./assets/images/splash_icon_padded.png",
          imageWidth: 240,
          resizeMode: "contain",
          backgroundColor: "#fefdf0",
          // The app has no dark theme: the splash stays the app's cream in dark mode too.
          dark: {
            backgroundColor: "#fefdf0",
          },
        },
      ],
      [
        "expo-asset",
        {
          assets: [
            "./assets/images/android_icon_foreground.png",
            "./assets/images/icon.png",
          ],
        },
      ],
      "expo-font",
      "react-native-navigation-mode",
      ["expo-image-picker"],
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow Coffer to use the camera to scan the handoff QR code at a marketplace meetup.",
          recordAudioAndroid: false,
        },
      ],
      // HTTPS only; debug builds may use plain HTTP to the emulator's host (dev server and local API) and nothing else.
      "./plugins/with_network_security.js",
      // Windows: a long-path-capable ninja for the native build (only when C:\ninja\ninja.exe exists).
      "./plugins/with_windows_ninja.js",
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
