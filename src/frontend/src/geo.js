// Shared geography helpers — derive a country + approximate lat/lng from a lab URL,
// so the globe can cluster facilities where they actually are.

const TLD = [
  [/\.ac\.uk$|\.uk$/, 'UK'], [/\.ac\.in$|\.res\.in$|\.iisc|\.iitb|\.ac\.in/, 'India'],
  [/\.edu\.au$|\.au$/, 'Australia'], [/\.ca$/, 'Canada'], [/\.ch$/, 'Switzerland'],
  [/\.de$/, 'Germany'], [/\.fr$/, 'France'], [/\.nl$/, 'Netherlands'], [/\.se$/, 'Sweden'],
  [/\.fi$/, 'Finland'], [/\.dk$/, 'Denmark'], [/\.be$/, 'Belgium'], [/\.il$/, 'Israel'],
  [/\.ac\.kr$|\.kr$/, 'South Korea'], [/\.ac\.jp$|\.jp$/, 'Japan'], [/\.edu\.sg$|\.sg$/, 'Singapore'],
  [/\.hk$/, 'Hong Kong'], [/\.tw$/, 'Taiwan'], [/\.tr$|bilkent/, 'Turkey'], [/\.br$|unicamp/, 'Brazil'],
  [/\.gov$/, 'USA'], [/\.edu$/, 'USA'],
];

const CENTROID = {
  USA: [39.8, -98.6], India: [22.6, 79], UK: [54, -2.4], Canada: [56, -106],
  Switzerland: [46.8, 8.2], Germany: [51.2, 10.4], France: [46.6, 2.2], Netherlands: [52.1, 5.3],
  Sweden: [60.1, 18.6], Finland: [64, 26], Denmark: [56, 10], Belgium: [50.5, 4.5], Israel: [31, 35],
  'South Korea': [36.5, 127.8], Japan: [36.2, 138.3], Singapore: [1.35, 103.8], 'Hong Kong': [22.3, 114.2],
  Taiwan: [23.7, 121], Australia: [-25, 133], Turkey: [39, 35], Brazil: [-14, -51.9],
};

export function countryOf(url) {
  let host = '';
  try { host = new URL(url).host; } catch { return null; }
  if (/github\.io|localhost|YOUR_GH/.test(host)) return null; // decoy placeholder
  for (const [re, name] of TLD) if (re.test(host)) return name;
  return host.split('.').slice(-1)[0]?.toUpperCase() || null;
}

// deterministic tiny jitter from a string, so co-located labs fan out
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

export function latLngOf(lab) {
  const c = countryOf(lab.url);
  const base = CENTROID[c];
  const jx = (hash(lab.id) - 0.5) * 14, jy = (hash(lab.id + 'y') - 0.5) * 14;
  if (base) return [base[0] + jx, base[1] + jy];
  // unknown → spread deterministically across the globe
  return [(hash(lab.id) - 0.5) * 150, (hash(lab.id + 'lng') - 0.5) * 360];
}

// lat/lng (deg) → unit-sphere xyz
export function latLngToXYZ(lat, lng) {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}
