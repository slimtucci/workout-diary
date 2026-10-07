/* SlimTucci runtime config. Public file: never put secrets here.
   WHOOP_WORKER_URL: the deployed Cloudflare Worker bridge, e.g. 'https://slimtucci-whoop.<you>.workers.dev'.
   Leave '' until the Worker is deployed. The app then shows "Setup needed" and manual Burn today entry. */
window.SLIMTUCCI_CONFIG = {
  WHOOP_WORKER_URL: ''
};
