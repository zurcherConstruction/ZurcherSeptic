/**
 * Normaliza nombres de ciudades a formato estándar
 * Para usar en Permits y Budget Items
 */

const normalizeCityName = (city) => {
  if (!city || typeof city !== 'string') return city;
  
  const cityTrimmed = city.trim();
  const cityUpper = cityTrimmed.toUpperCase();
  
  // Mapeo de variaciones comunes
  const cityMappings = {
    // SEBRING variations
    'SEBRING FL': 'SEBRING',
    'ST SEBRING': 'SEBRING',
    'AVE SEBRING': 'SEBRING',
    'BLVD SEBRING': 'SEBRING',
    'SEBRINGS': 'SEBRING',
    'DR SEBRIG': 'SEBRING',
    'CIR SEBRIG': 'SEBRING',
    
    // LEHIGH ACRES variations
    'LEHIGH ACRE': 'LEHIGH ACRES',
    
    // PORT CHARLOTTE variations
    'CHARLOTTE FL': 'PORT CHARLOTTE',
  };
  
  // Si hay un mapeo específico, usarlo
  if (cityMappings[cityUpper]) {
    return cityMappings[cityUpper];
  }
  
  // Lista de ciudades SAND estándar
  const sandCities = [
    'CAPE CORAL',
    'DELTONA',
    'LEHIGH ACRES',
    'NORTH PORT',
    'PORT CHARLOTTE',
    'SEBRING'
  ];
  
  // Buscar match exacto (case-insensitive)
  const exactMatch = sandCities.find(sc => sc === cityUpper);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Buscar si la ciudad normalizada contiene alguna ciudad SAND
  // (para casos como "SEBRING FL" que debe ser "SEBRING")
  for (const sandCity of sandCities) {
    if (cityUpper.includes(sandCity)) {
      return sandCity;
    }
  }
  
  // Si no hay match, normalizar a Title Case
  return cityTrimmed
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .toUpperCase(); // Para consistencia, devolver en MAYÚSCULAS
};

module.exports = { normalizeCityName };
