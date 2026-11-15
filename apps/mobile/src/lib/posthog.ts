import Constants from "expo-constants";
import PostHog from "posthog-react-native";

const extra = Constants.expoConfig?.extra ?? {};
const projectToken = extra.posthogProjectToken as string | undefined;
const host = extra.posthogHost as string | undefined;

if (__DEV__ && !projectToken) {
  console.error(
    "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
  );
}

if (__DEV__ && !host) {
  console.error(
    "POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured",
  );
}

export const posthog =
  projectToken && host
    ? new PostHog(projectToken, {
        host,
        captureAppLifecycleEvents: true,
        logs: {
          serviceName: "farmbridge-mobile",
          serviceVersion: Constants.expoConfig?.version,
          environment: __DEV__ ? "development" : "production",
        },
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
            console: [],
          },
        },
      })
    : null;

export const posthogLogger = {
  info(body: string, attributes: Record<string, string | number | boolean>) {
    posthog?.logger.info(body, attributes);
  },
  error(body: string, attributes: Record<string, string | number | boolean>) {
    posthog?.logger.error(body, attributes);
  },
};
