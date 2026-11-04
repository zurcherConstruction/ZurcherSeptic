/**
 * 🧭 ZurcherAI — recorridos desde el chat
 *
 * La IA junta las direcciones (por ejemplo, las instalaciones e inspecciones de mañana) y llama a
 * plan_route: se ubican en el mapa, se ordenan saliendo de la sede (siempre al más cercano) y se
 * devuelve cada tramo con millas y minutos, el total y el link de Google Maps.
 */
const geo = require('../geoService');

const MAX_STOPS = 25;
const GOOGLE_MAX_WAYPOINTS = 9;
const METERS_PER_MILE = 1609.34;

const PLAN_ROUTE_TOOL = {
  name: 'plan_route',
  description: `Plan a driving route that leaves from the company headquarters (Lehigh Acres) and visits several addresses in the best order (nearest next stop each time). Use it when the user asks for a route/recorrido, the order to visit jobs, or how far apart some jobs are. First collect the addresses with the other tools (e.g. installations, inspections or maintenance visits of a given day), then call this with up to ${MAX_STOPS} stops. Present the ordered stops with the time of each leg, the total, and the Google Maps link as a markdown link.`,
  input_schema: {
    type: 'object',
    properties: {
      stops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Full street address' },
            label: { type: 'string', description: 'Short description, e.g. "Instalación - Juan Pérez"' },
          },
          required: ['address'],
        },
      },
      roundTrip: { type: 'boolean', description: 'Return to headquarters at the end (default true)' },
      keepOrder: { type: 'boolean', description: 'Keep the given order instead of optimizing (default false)' },
    },
    required: ['stops'],
  },
};

const miles = (m) => +(m / METERS_PER_MILE).toFixed(1);
const minutes = (s) => Math.round(s / 60);

function googleUrl(hqAddress, points, roundTrip) {
  const point = (p) => `${p.lat},${p.lng}`;
  const destination = roundTrip ? hqAddress : point(points[points.length - 1]);
  const middle = (roundTrip ? points : points.slice(0, -1)).slice(0, GOOGLE_MAX_WAYPOINTS);
  const params = new URLSearchParams({ api: '1', origin: hqAddress, destination, travelmode: 'driving' });
  if (middle.length) params.set('waypoints', middle.map(point).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

async function planRoute({ stops = [], roundTrip = true, keepOrder = false }) {
  const list = stops.filter(s => s?.address).slice(0, MAX_STOPS);
  if (!list.length) throw new Error('No stops given');

  const [hq, { locations }] = await Promise.all([
    geo.geocodeAddress(geo.HQ_ADDRESS),
    geo.geocodeMany(list.map(s => s.address), { timeBudgetMs: 20000 }),
  ]);
  const base = { address: geo.HQ_ADDRESS, ...(hq || { lat: 26.5772, lng: -81.6356 }) };

  const located = list
    .map(s => ({ ...s, ...(locations[String(s.address).trim()] || {}) }))
    .filter(s => s.lat != null && s.lng != null);
  const notFound = list.filter(s => !located.some(l => l.address === s.address)).map(s => s.address);
  if (!located.length) return { error: 'None of the addresses could be located on the map', notFound };

  // Índice 0 = sede
  const matrix = await geo.drivingMatrix([base, ...located]);
  const trip = (i, j) => ({ meters: matrix.distances[i][j], seconds: matrix.durations[i][j] });

  let order = located.map((_, i) => i + 1);
  if (!keepOrder) {
    const left = [...order];
    order = [];
    let current = 0;
    while (left.length) {
      left.sort((a, b) => trip(current, a).seconds - trip(current, b).seconds);
      current = left.shift();
      order.push(current);
    }
  }

  let prev = 0;
  let totalMeters = 0;
  let totalSeconds = 0;
  const route = order.map((idx, k) => {
    const leg = trip(prev, idx);
    totalMeters += leg.meters;
    totalSeconds += leg.seconds;
    prev = idx;
    const stop = located[idx - 1];
    return { order: k + 1, address: stop.address, label: stop.label || null, legMiles: miles(leg.meters), legMinutes: minutes(leg.seconds) };
  });
  let back = null;
  if (roundTrip) {
    const leg = trip(prev, 0);
    totalMeters += leg.meters;
    totalSeconds += leg.seconds;
    back = { miles: miles(leg.meters), minutes: minutes(leg.seconds) };
  }

  const orderedPoints = order.map(idx => located[idx - 1]);
  return {
    start: geo.HQ_ADDRESS,
    stops: route,
    returnToHeadquarters: back,
    totalMiles: miles(totalMeters),
    totalDrivingMinutes: minutes(totalSeconds),
    approximate: !!matrix.approximate,
    note: 'Driving time only, without time spent at each stop.',
    googleMapsUrl: googleUrl(geo.HQ_ADDRESS, orderedPoints, roundTrip),
    googleMapsShowsOnlyFirst: orderedPoints.length > GOOGLE_MAX_WAYPOINTS + (roundTrip ? 0 : 1) ? GOOGLE_MAX_WAYPOINTS + (roundTrip ? 0 : 1) : undefined,
    notFound: notFound.length ? notFound : undefined,
  };
}

module.exports = { PLAN_ROUTE_TOOL, planRoute };
