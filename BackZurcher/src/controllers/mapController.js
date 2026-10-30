/**
 * 🗺️ Mapas de trabajos: sede, coordenadas de direcciones y distancias manejando.
 *   GET  /maps/base                       → sede (Lehigh) + máquinas/vehículos activos de Zurcher
 *   POST /maps/geocode   { addresses[] }  → { locations: { [address]: {lat,lng}|null }, pending }
 *   POST /maps/matrix    { points[] }     → { distances[][] (m), durations[][] (s), approximate }
 *   PUT  /maps/location  { address, lat, lng } → corrige a mano la ubicación de una dirección
 */
const { FleetAsset } = require('../data');
const geo = require('../services/geoService');

const MAX_ADDRESSES = 400;
const MAX_MATRIX_POINTS = 90;

const getBase = async (req, res) => {
  try {
    const [hq, fleet] = await Promise.all([
      geo.geocodeAddress(geo.HQ_ADDRESS),
      FleetAsset.findAll({
        where: { companyType: 'zurcher', status: ['active', 'in_repair'] },
        attributes: ['id', 'name', 'assetType', 'brand', 'model', 'licensePlate', 'status', 'imageUrl'],
        order: [['assetType', 'ASC'], ['name', 'ASC']],
      }),
    ]);
    res.json({ hq: { address: geo.HQ_ADDRESS, ...(hq || { lat: 26.5772, lng: -81.6356 }) }, fleet });
  } catch (error) {
    console.error('❌ [Maps] base:', error.message);
    res.status(500).json({ error: 'No se pudo cargar la sede' });
  }
};

const geocode = async (req, res) => {
  const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses.slice(0, MAX_ADDRESSES) : null;
  if (!addresses) return res.status(400).json({ error: 'addresses es requerido' });
  try {
    res.json(await geo.geocodeMany(addresses));
  } catch (error) {
    console.error('❌ [Maps] geocode:', error.message);
    res.status(500).json({ error: 'No se pudieron ubicar las direcciones' });
  }
};

const matrix = async (req, res) => {
  const points = Array.isArray(req.body?.points) ? req.body.points : null;
  const valid = points?.every(p => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)));
  if (!valid || points.length > MAX_MATRIX_POINTS) {
    return res.status(400).json({ error: `points debe ser una lista de hasta ${MAX_MATRIX_POINTS} coordenadas` });
  }
  try {
    res.json(await geo.drivingMatrix(points.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))));
  } catch (error) {
    console.error('❌ [Maps] matrix:', error.message);
    res.status(500).json({ error: 'No se pudieron calcular las distancias' });
  }
};

const setLocation = async (req, res) => {
  const { address } = req.body || {};
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'address, lat y lng son requeridos' });
  }
  try {
    res.json(await geo.setManualLocation(address, lat, lng));
  } catch (error) {
    console.error('❌ [Maps] location:', error.message);
    res.status(500).json({ error: 'No se pudo guardar la ubicación' });
  }
};

module.exports = { getBase, geocode, matrix, setLocation };
