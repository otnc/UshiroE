import type { AreaId, Size } from "./model";

/** Version of the {@link LiveConfig} shape that the injected runtime understands. */
export const LIVE_CONFIG_VERSION = 1;

export interface LiveArea {
  id: AreaId;
  /** `vscode-file:` URLs of the images, in play order. */
  images: string[];
  opacity: number;
  size: Size;
  position: string;
  blur: number;
  random: boolean;
  /** Milliseconds between image changes; 0 disables rotation. */
  interval: number;
  /**
   * Move on once per window start instead of on a timer. Optional, so a runtime patched in by an older UshiroE keeps reading the config.
   */
  changeOnStartupOnly?: boolean;
}

/**
 * Configuration the extension writes to disk and the injected runtime polls, so most setting changes apply without reloading the window.
 */
export interface LiveConfig {
  v: typeof LIVE_CONFIG_VERSION;
  enabled: boolean;
  transition: number;
  areas: LiveArea[];
  /** Incremented by the "next image" command; any change advances every rotating area. */
  cycle: number;
}

export const EMPTY_LIVE_CONFIG: LiveConfig = {
  v: LIVE_CONFIG_VERSION,
  enabled: false,
  transition: 1,
  areas: [],
  cycle: 0,
};
