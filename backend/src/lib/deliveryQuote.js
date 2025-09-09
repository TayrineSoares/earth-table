const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;
const PICKUP_LAT = parseFloat(process.env.PICKUP_LAT || "");
const PICKUP_LON = parseFloat(process.env.PICKUP_LON || "");
const PC = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

function km(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getServerDeliveryQuote(postalCode) {
  if (!GEOAPIFY_KEY || !Number.isFinite(PICKUP_LAT) || !Number.isFinite(PICKUP_LON)) {
    return { ok: false, reason: "SERVER_MISCONFIG" };
  }
  if (typeof postalCode !== "string" || !PC.test(postalCode)) {
    return { ok: false, reason: "INVALID_POSTAL" };
  }

  const raw = postalCode.toUpperCase().replace(/\s+/g, "");
  const spaced = raw.length === 6 ? `${raw.slice(0,3)} ${raw.slice(3)}` : postalCode;
  const queries = [`${spaced}, Canada`, `${raw}, Canada`];

  // 5s timeout so the request doesn’t hang
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let feature = null;
  for (const q of queries) {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&filter=countrycode:ca&limit=1&apiKey=${GEOAPIFY_KEY}`;
    try {
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) continue;
      const data = await r.json().catch(() => null);
      const f = data?.features?.[0];
      if (f?.properties?.lat != null && f?.properties?.lon != null) {
        feature = f;
        break;
      }
    } catch (err) {
      // abort or transient fetch error → try next query or fail after loop
      if (err?.name === "AbortError") break;
      continue;
    }
  }

  clearTimeout(timeout);

  if (!feature) return { ok: false, reason: "INVALID_POSTAL" };

  const lat = Number(feature.properties.lat);
  const lon = Number(feature.properties.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, reason: "INVALID_POSTAL" };
  }

  const distanceKm = Math.round(km(PICKUP_LAT, PICKUP_LON, lat, lon) * 10) / 10;

  if (distanceKm > 30) return { ok: false, reason: "OUT_OF_ZONE", km: distanceKm };

  const fee_cents = distanceKm <= 10 ? 1500 : 3000;
  return { ok: true, km: distanceKm, fee_cents };
}

module.exports = { getServerDeliveryQuote };
