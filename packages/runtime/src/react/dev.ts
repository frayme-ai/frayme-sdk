/**
 * `isDev` — see `core/dev.ts` (the single definition; moved there so the
 * server-safe core can gate its own dev warnings). Re-exported here so the
 * client modules keep importing `./dev.js`.
 */
export { isDev } from '../core/dev.js';
