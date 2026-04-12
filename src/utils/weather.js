export const WMO_CODES = {
  0:  { label: 'Despejado',                  emoji: '☀️',  bg: 'clear' },
  1:  { label: 'Principalmente despejado',   emoji: '🌤️', bg: 'clear' },
  2:  { label: 'Parcialmente nublado',       emoji: '⛅',  bg: 'cloudy' },
  3:  { label: 'Nublado',                    emoji: '☁️',  bg: 'cloudy' },
  45: { label: 'Niebla',                     emoji: '🌫️', bg: 'cloudy' },
  48: { label: 'Niebla con escarcha',        emoji: '🌫️', bg: 'cloudy' },
  51: { label: 'Llovizna ligera',            emoji: '🌦️', bg: 'rain' },
  53: { label: 'Llovizna moderada',          emoji: '🌦️', bg: 'rain' },
  55: { label: 'Llovizna densa',             emoji: '🌧️', bg: 'rain' },
  61: { label: 'Lluvia ligera',              emoji: '🌧️', bg: 'rain' },
  63: { label: 'Lluvia moderada',            emoji: '🌧️', bg: 'rain' },
  65: { label: 'Lluvia intensa',             emoji: '🌧️', bg: 'rain' },
  71: { label: 'Nieve ligera',               emoji: '🌨️', bg: 'snow' },
  73: { label: 'Nieve moderada',             emoji: '❄️',  bg: 'snow' },
  75: { label: 'Nieve intensa',              emoji: '❄️',  bg: 'snow' },
  77: { label: 'Aguanieve',                  emoji: '🌨️', bg: 'snow' },
  80: { label: 'Chubascos ligeros',          emoji: '🌦️', bg: 'rain' },
  81: { label: 'Chubascos moderados',        emoji: '🌧️', bg: 'rain' },
  82: { label: 'Chubascos violentos',        emoji: '⛈️',  bg: 'storm' },
  85: { label: 'Nieve en chubascos',         emoji: '🌨️', bg: 'snow' },
  86: { label: 'Nieve intensa',              emoji: '❄️',  bg: 'snow' },
  95: { label: 'Tormenta',                   emoji: '⛈️',  bg: 'storm' },
  96: { label: 'Tormenta con granizo',       emoji: '⛈️',  bg: 'storm' },
  99: { label: 'Tormenta con granizo fuerte',emoji: '⛈️',  bg: 'storm' },
}

export function getWeatherInfo(code) {
  return WMO_CODES[code] ?? { label: 'Desconocido', emoji: '🌡️', bg: 'clear' }
}

export function getWindDirection(degrees) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(degrees / 45) % 8]
}

export function getDayName(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-ES', { weekday: 'short' })
}

export function formatLocation(displayName) {
  return displayName.split(',').slice(0, 3).join(',').trim()
}

// ── UV index risk levels (tarea 12) ─────────────────────
export function getUvInfo(uv) {
  if (uv <= 2)  return { label: 'Bajo',     color: '#4caf50' }
  if (uv <= 5)  return { label: 'Moderado', color: '#ffeb3b' }
  if (uv <= 7)  return { label: 'Alto',     color: '#ff9800' }
  if (uv <= 10) return { label: 'Muy alto', color: '#f44336' }
  return          { label: 'Extremo',   color: '#9c27b0' }
}

// ── Local time in city timezone (tarea 13) ───────────────
export function getLocalTime(timezone) {
  return new Date().toLocaleTimeString('es-ES', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Format last-updated timestamp (tarea 14) ────────────
export function formatUpdatedAt(isoTime, timezone) {
  return new Date(isoTime).toLocaleTimeString('es-ES', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
}
