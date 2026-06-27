// Shared/MapUtils.ts
export const formatCoords = (obj: any): [number, number] | null => {
  if (!obj || !obj.lng || !obj.lat) return null;
  return [Number(obj.lng), Number(obj.lat)];
};

export const getRoutePath = async (start: [number, number], end: [number, number]) => {
  try {
    const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`);
    const data = await resp.json();
    return data.routes[0]?.geometry; // Returns GeoJSON LineString
  } catch (e) {
    return { type: 'LineString', coordinates: [start, end] }; // Fallback to straight line
  }
};