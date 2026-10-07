/* SlimTucci runtime config. Public file: never put secrets here.
   WHOOP_WORKER_URL: the deployed Cloudflare Worker bridge, e.g. 'https://slimtucci-whoop.<you>.workers.dev'.
   Leave '' until the Worker is deployed. The app then shows "Setup needed" and manual Burn today entry.
   DASHBOARD_URL: the SlimTucci admin dashboard (same Worker). "Dashboard sync" posts workouts there with a write-only code. */
window.SLIMTUCCI_CONFIG = {
  WHOOP_WORKER_URL: 'https://slimtucci-whoop.slimtucci.workers.dev',
  DASHBOARD_URL: 'https://slimtucci-whoop.slimtucci.workers.dev'
};
