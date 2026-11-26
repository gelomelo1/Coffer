// Windows only: native (CMake) builds fail with "Filename longer than 260 characters", because the Android SDK's ninja
// (1.10) can't use long paths. A newer ninja (1.12+, here C:\ninja\ninja.exe) can; this points CMake at it and lets it
// write long object paths. Kept as a plugin so `expo prebuild --clean` doesn't drop it. Other machines (EAS, Linux,
// macOS, or Windows without C:\ninja) get the build.gradle unchanged.
const fs = require("fs");
const { withAppBuildGradle } = require("expo/config-plugins");

const NINJA = "C:\\ninja\\ninja.exe";
const MARKER = "-DCMAKE_OBJECT_PATH_MAX=1024";

module.exports = function withWindowsNinja(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (process.platform !== "win32" || !fs.existsSync(NINJA) || cfg.modResults.contents.includes(MARKER)) return cfg;
    const block = [
      "        externalNativeBuild {",
      "            cmake {",
      `                arguments "-DCMAKE_MAKE_PROGRAM=${NINJA.replace(/\\/g, "\\\\")}", "${MARKER}"`,
      "            }",
      "        }",
    ].join("\n");
    cfg.modResults.contents = cfg.modResults.contents.replace(/defaultConfig \{\n/, (m) => `${m}${block}\n`);
    return cfg;
  });
};
