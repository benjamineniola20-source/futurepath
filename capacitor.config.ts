import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.futurepath.learning",
  appName: "FuturePath",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
