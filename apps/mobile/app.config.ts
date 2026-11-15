import type { ExpoConfig } from "expo/config";

import appConfig from "./app.json";

const config = appConfig.expo as ExpoConfig;

export default {
  ...config,
  extra: {
    ...config.extra,
    posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
    posthogHost: process.env.POSTHOG_HOST,
  },
};
