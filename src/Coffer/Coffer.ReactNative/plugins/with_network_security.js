// Android network policy: HTTPS only.
// - Release builds: no cleartext (plain HTTP) traffic at all.
// - Debug builds (dev client + Metro): plain HTTP only to the emulator's host — 10.0.2.2 (the host machine as seen
//   from the emulator), localhost and 127.0.0.1 — for the dev server and the local API. Nothing else.
// The debug file overrides the main one through Android's debug source set, so release builds never contain it.
const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const RELEASE_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>
`;

const DEBUG_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
    </domain-config>
</network-security-config>
`;

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:usesCleartextTraffic"] = "false";
      application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    }
    return cfg;
  });
}

function withConfigFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const app = path.join(cfg.modRequest.platformProjectRoot, "app", "src");
      for (const [set, content] of [
        ["main", RELEASE_CONFIG],
        ["debug", DEBUG_CONFIG],
      ]) {
        const dir = path.join(app, set, "res", "xml");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "network_security_config.xml"), content);
      }
      // The React Native template lets debug builds send plain HTTP anywhere; the debug config above replaces that.
      const debugManifest = path.join(app, "debug", "AndroidManifest.xml");
      if (fs.existsSync(debugManifest)) {
        const text = fs.readFileSync(debugManifest, "utf8");
        fs.writeFileSync(debugManifest, text.replace('android:usesCleartextTraffic="true"', 'android:usesCleartextTraffic="false"'));
      }
      return cfg;
    },
  ]);
}

module.exports = function withNetworkSecurity(config) {
  return withConfigFiles(withManifest(config));
};
