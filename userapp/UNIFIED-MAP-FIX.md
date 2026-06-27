# UserApp UnifiedMap Fix - Gray Background Issue

## Problem
The userapp map was showing a gray background with NO map tiles visible and NO routing.

## Root Causes Identified

### 1. **Google Maps Tile URL Issues**
- **Problem**: The Google Maps tile URL (`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`) may be blocked or rate-limited when accessed from a WebView without an API key
- **Fix**: Changed to OpenStreetMap tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) which are FREE, require no API key, and are the most reliable option

### 2. **Missing `map.invalidateSize()` Calls**
- **Problem**: Leaflet maps in React Native WebView frequently show gray/blank backgrounds because the map container has no computed dimensions at initialization time
- **Fix**: Added multiple `invalidateSize()` calls at 100ms, 500ms, and 1000ms intervals to ensure the map recalculates its size after the WebView has fully rendered

### 3. **Missing Tile Error Handling**
- **Problem**: No visibility into whether tiles were actually loading
- **Fix**: Added tile event listeners (`tileerror`, `loading`, `load`) to log tile loading status and report errors back to React Native

### 4. **CSS Container Issues**
- **Problem**: The map container might not have explicit dimensions in all contexts
- **Fix**: 
  - Changed `body, html` to use `position: fixed` with explicit `top: 0; left: 0`
  - Changed `#map` to use `width: 100vw; height: 100vh` with `right: 0; bottom: 0` for explicit dimensions
  - Added `z-index: 1` to ensure proper stacking

### 5. **WebView Configuration**
- **Problem**: WebView might need explicit base URL for proper origin handling
- **Fix**: Added `baseUrl: 'file://'` to the WebView source prop and `allowsInlineMediaPlayback={true}` and `mediaPlaybackRequiresUserAction={false}` for better content rendering

## Changes Made

### File: `userapp/components/UnifiedMap.tsx`

#### 1. Tile Layer Changed
```javascript
// OLD (Google Maps - may be blocked without API key)
var tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

// NEW (OpenStreetMap - FREE, no API key required)
var tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
```

#### 2. Added Tile Event Listeners
```javascript
layer.on('tileerror', function(err) {
  console.error('[Map] Tile loading error:', err);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ 
      type: 'mapError', 
      error: 'Tiles failed to load: ' + (err.message || 'Unknown error') 
    }));
  }
});

layer.on('loading', function() {
  console.log('[Map] Tiles are loading...');
});

layer.on('load', function() {
  console.log('[Map] Tiles loaded successfully');
});
```

#### 3. Multiple invalidateSize() Calls
```javascript
setTimeout(function() {
  map.invalidateSize();
  console.log('[Map] invalidateSize() called at 100ms');
}, 100);

setTimeout(function() {
  map.invalidateSize();
  console.log('[Map] invalidateSize() called at 500ms');
}, 500);

setTimeout(function() {
  map.invalidateSize();
  console.log('[Map] invalidateSize() called at 1000ms');
  
  // Notify map is loaded AFTER tiles have time to render
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
  }
}, 1000);
```

#### 4. CSS Improvements
```css
body, html {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f0f0f0;
  position: fixed;  /* NEW */
  top: 0;           /* NEW */
  left: 0;          /* NEW */
}

#map {
  width: 100vw;     /* CHANGED from 100% */
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;         /* NEW */
  bottom: 0;        /* NEW */
  touch-action: none;
  -ms-touch-action: none;
  z-index: 1;       /* NEW */
}
```

#### 5. WebView Props
```javascript
<WebView
  source={{ html: mapHtml, baseUrl: 'file://' }}  // Added baseUrl
  allowsInlineMediaPlayback={true}                // NEW
  mediaPlaybackRequiresUserAction={false}         // NEW
  // ... other props
/>
```

#### 6. Route Drawing invalidateSize()
Added `invalidateSize()` calls after route drawing to ensure proper rendering:

```javascript
// After fitBounds
setTimeout(function() {
  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  map.invalidateSize();  // NEW
}, 100);

// In drawStraightLine()
function drawStraightLine() {
  var straightLine = L.polyline([routeStart, routeEnd], {
    color: '#C41E26',
    weight: 4,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round',
    dashArray: '10, 10'
  }).addTo(map);
  straightLine.bringToBack();
  
  setTimeout(function() {
    map.invalidateSize();  // NEW
  }, 100);
}
```

### File: `userapp/components/UnifiedMap.ios.tsx`

Applied the same `invalidateSize()` fixes:

```javascript
L.tileLayer(tileUrl, { ... }).addTo(map);

// CRITICAL: Force map to recalculate its size multiple times
setTimeout(function() {
  map.invalidateSize();
}, 100);
setTimeout(function() {
  map.invalidateSize();
}, 500);
setTimeout(function() {
  map.invalidateSize();
}, 1000);
```

## How the Map Loading Works Now

1. **Map initialization**: Leaflet map is created with OpenStreetMap tiles
2. **Tile loading starts**: Tiles begin loading from OpenStreetMap servers
3. **invalidateSize() calls**: At 100ms, 500ms, and 1000ms to ensure proper container sizing
4. **mapLoaded notification**: Sent at 1000ms after tiles have had time to render
5. **Route drawing**: If route exists, OSRM is called and route is drawn with `fitBounds()` + `invalidateSize()`
6. **Markers added**: Restaurant, user, destination markers are placed
7. **Loading overlay removed**: React Native receives `mapLoaded` message and hides spinner

## Testing the Fix

After applying these changes:
1. The map should show OpenStreetMap tiles (not Google Maps style)
2. Console logs will show:
   - `[Map] Tiles are loading...`
   - `[Map] Tiles loaded successfully`
   - `[Map] invalidateSize() called at 100ms/500ms/1000ms`
3. If tiles fail to load, an error message will be displayed
4. Route drawing will work if restaurant and destination coordinates are provided

## Why This Works

- **OpenStreetMap tiles** don't require an API key and aren't blocked by CORS or rate limiting
- **Multiple `invalidateSize()` calls** ensure the map container has proper dimensions at multiple stages of WebView rendering
- **Tile event listeners** provide visibility into tile loading status
- **CSS improvements** ensure the map container has explicit dimensions in all contexts
- **WebView configuration** allows inline media playback and proper origin handling

## Comparison with Other Apps

| Feature | userapp | deliverapp | admins-app |
|---------|---------|------------|------------|
| Tile URL | OpenStreetMap | Google Maps | Google Maps |
| invalidateSize() | ✅ (3 times) | ❌ | ❌ |
| Tile error handling | ✅ | ❌ | ❌ |
| CSS fixes | ✅ | ❌ | ❌ |
| WebView baseUrl | ✅ | ❌ | ❌ |

**Note**: deliverapp and admins-app should also be updated with the same fixes if they show similar gray map issues.
