/**
 * Map Marker Icons
 *
 * High-quality SVG markers for different location types:
 * - Restaurant/Food locations
 * - User/Customer locations
 * - Delivery Driver locations
 * - Destination/Pickup points
 *
 * These markers are designed to work on both Android and iOS with react-native-maps.
 */

// Color palette
const COLORS = {
  restaurant: '#C41E26',    // Brand red
  user: '#4CAF50',          // Green
  driver: '#FF9800',        // Orange
  destination: '#2196F3',   // Blue
  admin: '#9C27B0',         // Purple
};

/**
 * Create SVG marker icon as data URI
 * @param color - Background circle color
 * @param emoji - Emoji to display in center
 * @param size - Icon size (default: 40)
 */
export const createMarkerIcon = (
  color: string,
  emoji: string,
  size: number = 40
): string => {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow -->
      <ellipse cx="${size * 0.5}" cy="${size * 0.85}" rx="${size * 0.35}" ry="${size * 0.1}" fill="rgba(0,0,0,0.2)"/>
      
      <!-- Main circle background -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="${color}"/>
      
      <!-- White border -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="none" stroke="white" stroke-width="${size * 0.08}"/>
      
      <!-- Emoji -->
      <text x="${size * 0.5}" y="${size * 0.52}" font-size="${size * 0.5}" text-anchor="middle" dominant-baseline="middle" fill="white">${emoji}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Create marker icon with pin shape (teardrop)
 * @param color - Pin color
 * @param emoji - Emoji to display
 * @param size - Icon size
 */
export const createPinMarkerIcon = (
  color: string,
  emoji: string,
  size: number = 48
): string => {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow -->
      <ellipse cx="${size * 0.5}" cy="${size * 0.9}" rx="${size * 0.35}" ry="${size * 0.08}" fill="rgba(0,0,0,0.25)"/>
      
      <!-- Pin shape (teardrop) -->
      <path d="M${size * 0.5} ${size * 0.05} 
               C${size * 0.2} ${size * 0.05}, ${size * 0.05} ${size * 0.35}, ${size * 0.05} ${size * 0.55} 
               C${size * 0.05} ${size * 0.75}, ${size * 0.5} ${size * 0.95}, ${size * 0.5} ${size * 0.95} 
               C${size * 0.5} ${size * 0.95}, ${size * 0.95} ${size * 0.75}, ${size * 0.95} ${size * 0.55} 
               C${size * 0.95} ${size * 0.35}, ${size * 0.8} ${size * 0.05}, ${size * 0.5} ${size * 0.05} Z" 
            fill="${color}"/>
      
      <!-- White border -->
      <path d="M${size * 0.5} ${size * 0.05} 
               C${size * 0.2} ${size * 0.05}, ${size * 0.05} ${size * 0.35}, ${size * 0.05} ${size * 0.55} 
               C${size * 0.05} ${size * 0.75}, ${size * 0.5} ${size * 0.95}, ${size * 0.5} ${size * 0.95} 
               C${size * 0.5} ${size * 0.95}, ${size * 0.95} ${size * 0.75}, ${size * 0.95} ${size * 0.55} 
               C${size * 0.95} ${size * 0.35}, ${size * 0.8} ${size * 0.05}, ${size * 0.5} ${size * 0.05} Z" 
            fill="none" stroke="white" stroke-width="${size * 0.06}"/>
      
      <!-- White circle for emoji -->
      <circle cx="${size * 0.5}" cy="${size * 0.4}" r="${size * 0.25}" fill="white"/>
      
      <!-- Emoji -->
      <text x="${size * 0.5}" y="${size * 0.45}" font-size="${size * 0.35}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Pre-built marker icons for different use cases
 */
export const MARKER_ICONS = {
  // Restaurant markers
  restaurant: createPinMarkerIcon(COLORS.restaurant, '🏪', 48),
  restaurantFood: createPinMarkerIcon(COLORS.restaurant, '🍔', 48),
  restaurantPizza: createPinMarkerIcon(COLORS.restaurant, '🍕', 48),
  restaurantCoffee: createPinMarkerIcon(COLORS.restaurant, '☕', 48),
  
  // User/Customer markers
  user: createPinMarkerIcon(COLORS.user, '👤', 48),
  customer: createPinMarkerIcon(COLORS.user, '🛒', 48),
  home: createPinMarkerIcon(COLORS.user, '🏠', 48),
  
  // Driver markers
  driver: createPinMarkerIcon(COLORS.driver, '🚴', 48),
  driverBike: createPinMarkerIcon(COLORS.driver, '🏍️', 48),
  driverCar: createPinMarkerIcon(COLORS.driver, '🚗', 48),
  delivery: createPinMarkerIcon(COLORS.driver, '📦', 48),
  
  // Destination markers
  destination: createPinMarkerIcon(COLORS.destination, '📍', 48),
  location: createPinMarkerIcon(COLORS.destination, '🗺️', 48),
  pickup: createPinMarkerIcon(COLORS.destination, '📍', 48),
  
  // Admin markers
  admin: createPinMarkerIcon(COLORS.admin, '👨‍💼', 48),
  office: createPinMarkerIcon(COLORS.admin, '🏢', 48),
  
  // Simple circle markers (fallback)
  restaurantCircle: createMarkerIcon(COLORS.restaurant, '🏪', 40),
  userCircle: createMarkerIcon(COLORS.user, '👤', 40),
  driverCircle: createMarkerIcon(COLORS.driver, '🚴', 40),
  destinationCircle: createMarkerIcon(COLORS.destination, '📍', 40),
};

/**
 * Get marker icon by type
 * @param type - Marker type
 * @param size - Optional custom size
 */
export const getMarkerIcon = (
  type: keyof typeof MARKER_ICONS,
  size?: number
): string => {
  if (size) {
    // Regenerate icon with custom size
    const icon = MARKER_ICONS[type];
    // For simplicity, return the default and let the platform scale it
    // In production, you might want to regenerate the SVG with the new size
  }
  return MARKER_ICONS[type] || MARKER_ICONS.location;
};

/**
 * Create custom marker with profile picture
 * @param pictureUrl - URL of profile picture
 * @param color - Border color
 * @param size - Icon size
 */
export const createProfileMarkerIcon = (
  pictureUrl: string,
  color: string = COLORS.driver,
  size: number = 48
): string => {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="circleClip">
          <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.35}"/>
        </clipPath>
      </defs>
      
      <!-- Shadow -->
      <ellipse cx="${size * 0.5}" cy="${size * 0.85}" rx="${size * 0.35}" ry="${size * 0.1}" fill="rgba(0,0,0,0.2)"/>
      
      <!-- Main circle background -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="${color}"/>
      
      <!-- White border -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="none" stroke="white" stroke-width="${size * 0.08}"/>
      
      <!-- Profile picture (clipped to circle) -->
      <image href="${pictureUrl}" x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" clip-path="url(#circleClip)"/>
      
      <!-- Outer ring -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="none" stroke="${color}" stroke-width="${size * 0.04}"/>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Create marker with label badge
 * @param color - Main color
 * @param emoji - Main emoji
 * @param badge - Badge text (e.g., number)
 * @param size - Icon size
 */
export const createBadgeMarkerIcon = (
  color: string,
  emoji: string,
  badge: string,
  size: number = 48
): string => {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow -->
      <ellipse cx="${size * 0.5}" cy="${size * 0.85}" rx="${size * 0.35}" ry="${size * 0.1}" fill="rgba(0,0,0,0.2)"/>
      
      <!-- Main circle -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="${color}"/>
      
      <!-- White border -->
      <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.4}" fill="none" stroke="white" stroke-width="${size * 0.08}"/>
      
      <!-- Emoji -->
      <text x="${size * 0.5}" y="${size * 0.52}" font-size="${size * 0.45}" text-anchor="middle" dominant-baseline="middle" fill="white">${emoji}</text>
      
      <!-- Badge -->
      <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${size * 0.18}" fill="#FF5722"/>
      <text x="${size * 0.75}" y="${size * 0.3}" font-size="${size * 0.2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-weight="bold">${badge}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export default MARKER_ICONS;
