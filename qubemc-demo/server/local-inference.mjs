// Physical inference server: the DGX Spark on the private Tailscale network.
export const SPARK_LLM_URL = 'http://100.89.121.112:8000/v1/chat/completions';
export function localModelUrl(value = SPARK_LLM_URL) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Model endpoint must be the local Spark Tailscale endpoint.'); }
  if (url.origin !== 'http://100.89.121.112:8000' || url.pathname !== '/v1/chat/completions' || url.username || url.password || url.search || url.hash)
    throw new Error('Model endpoint must be the local Spark Tailscale endpoint.');
  return url.href;
}
export function inferenceMode() {
  const mode = process.env.COFLOOR_INFERENCE || 'nemoclaw';
  if (!['nemoclaw', 'local'].includes(mode)) throw new Error('Model inference mode must be nemoclaw or local.');
  return mode;
}
