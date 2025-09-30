// Geoapify geocoding → Haversine distance → fee bands
const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
const PICKUP_LAT = parseFloat(process.env.PICKUP_LAT || "");
const PICKUP_LON = parseFloat(process.env.PICKUP_LON || "");
const PC = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/; // Canadian postal code

// Allowlist for CORS (prod + preview + local)
const ALLOW_ORIGINS = new Set([
  'https://www.earthtableco.ca',
  'https://earth-table-frontend.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);


function km(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Small helper: set CORS headers for this request
function setCors(res, origin) {
  if (origin && ALLOW_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  // CORS for serverless
  const origin = req.headers.origin || '';
  setCors(res, origin);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") { res.status(405).end("Method Not Allowed"); return; }

  try {
    if (!GEOAPIFY_KEY || !Number.isFinite(PICKUP_LAT) || !Number.isFinite(PICKUP_LON)) {
      return res.status(500).json({ ok: false, reason: "SERVER_MISCONFIG" });
    }

    const { postalCode } = req.body || {};
    if (typeof postalCode !== "string" || !PC.test(postalCode)) {
    
      return res.status(400).json({ ok: false, reason: "INVALID_POSTAL" });
    }

    const raw = postalCode.toUpperCase().replace(/\s+/g, "");
    const spaced = raw.length === 6 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : postalCode;
    const queries = [`${spaced}, Canada`, `${raw}, Canada`];

    console.log('[quote] postal:', postalCode);
    let feature = null;
    for (const q of queries) {
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&filter=countrycode:ca&limit=1&apiKey=${GEOAPIFY_KEY}`;

      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json().catch(() => null);
      const f = data?.features?.[0];
      if (f?.properties?.lat && f?.properties?.lon) {
        feature = f;
        break;
      }
    }

    if (!feature) {
      return res.status(400).json({ ok: false, reason: "INVALID_POSTAL" });
    }

    const lat = Number(feature.properties.lat);
    const lon = Number(feature.properties.lon);


    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, reason: "INVALID_POSTAL" });
    }

    const distanceKm = Math.round(km(PICKUP_LAT, PICKUP_LON, lat, lon) * 10) / 10;
    if (distanceKm > 30) {
      console.log('[quote] out of zone:', distanceKm);
      return res.json({ ok: false, reason: "OUT_OF_ZONE", km: distanceKm });
    }

    const fee_cents = distanceKm <= 10 ? 1500 : 3000;

    return res.json({ ok: true, km: distanceKm, fee_cents });
  } catch (e) {
    console.error("delivery/quote error", e);
    return res.status(500).json({ ok: false, reason: "SERVER_ERROR" });
  }
};
