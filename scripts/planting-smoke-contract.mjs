// Read the owning HTML contract, not a second hard-coded cache-bust version.
export function readPlantingContract(html) {
  const ui = html.match(/\bdata-planting-ui="([^"]+)"/)?.[1];
  const script = html.match(/<script\b[^>]*\bsrc="(\/assets\/national-planting-page-v3\.js\?v=[^"]+)"/)?.[1];
  if (!ui || !script) throw new Error('Owning planting HTML is missing its versioned runtime contract');
  return { ui, script };
}
export function isMeasurementHost(host) {
  return /(?:^|\.)(?:google-analytics\.com|analytics\.google\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|googleadservices\.com)$/.test(host);
}
