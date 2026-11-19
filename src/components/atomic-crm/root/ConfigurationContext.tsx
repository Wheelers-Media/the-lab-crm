import { useMemo } from "react";
import { useStore } from "ra-core";

import type { AttentionSnoozes } from "../operations/attentionSnooze";
import type { DealStage, LabeledValue, NoteStatus } from "../types";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  currency: string;
  dealCategories: LabeledValue[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  /** Monthly goals for the home screen's rings; unset means "suggest one". */
  targets?: MonthlyTargets;
  /** Rows of Home's Needs attention card hidden for now, shared across devices. */
  attentionSnoozed?: AttentionSnoozes;
}

export interface MonthlyTargets {
  revenue?: number;
  orders?: number;
  newCustomers?: number;
}

/**
 * A logo URL that points at this app's own build output (or is relative) is a
 * snapshot of a past deploy's hashed asset, e.g. /assets/logo-AbC123.png. It
 * 404s once the file changes, so it must never override the current default.
 * Uploaded logos live on another host (storage) or are data URIs: keep those.
 */
export const isStaleBuildLogo = (
  logo: unknown,
  origin: string = window.location.origin,
): boolean => {
  if (typeof logo !== "string" || logo === "") return true;
  if (logo.startsWith("data:")) return false;
  try {
    return new URL(logo, origin).origin === origin;
  } catch {
    return true;
  }
};

export const mergeWithDefaults = (
  config: Partial<ConfigurationContextValue> | undefined,
  origin?: string,
): ConfigurationContextValue => {
  const merged = { ...defaultConfiguration, ...config };
  return {
    ...merged,
    darkModeLogo: isStaleBuildLogo(merged.darkModeLogo, origin)
      ? defaultConfiguration.darkModeLogo
      : merged.darkModeLogo,
    lightModeLogo: isStaleBuildLogo(merged.lightModeLogo, origin)
      ? defaultConfiguration.lightModeLogo
      : merged.lightModeLogo,
  };
};

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => mergeWithDefaults(config), [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
