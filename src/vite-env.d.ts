/// <reference types="vite/client" />

/** Unique per build (vite.config.ts `define`): invalidates the saved query cache on deploy. */
declare const __BUILD_ID__: string

/** Where this build runs: Vercel's VERCEL_ENV (production / preview), else "local". */
declare const __APP_ENV__: string
