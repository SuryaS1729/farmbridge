import { createContext, useContext } from "react";

type OnboardingContextValue = {
  /** Call after the farm details are saved so the app opens. */
  markOnboarded: () => void;
};

export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null,
);

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error("useOnboarding must be used inside OnboardingContext.");
  }
  return value;
}
