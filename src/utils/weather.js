export const WMO_CODES = {
  0:  { label: 'Despejado',                   icon: 'Sun',            bg: 'clear'  },
  1:  { label: 'Principalmente despejado',    icon: 'CloudSun',       bg: 'clear'  },
  2:  { label: 'Parcialmente nublado',        icon: 'CloudSun',       bg: 'cloudy' },
  3:  { label: 'Nublado',                     icon: 'Cloud',          bg: 'cloudy' },
  45: { label: 'Niebla',                      icon: 'CloudFog',       bg: 'cloudy' },
  48: { label: 'Niebla con escarcha',         icon: 'CloudFog',       bg: 'cloudy' },
  51: { label: 'Llovizna ligera',             icon: 'CloudDrizzle',   bg: 'rain'   },
  53: { label: 'Llovizna moderada',           icon: 'CloudDrizzle',   bg: 'rain'   },
  55: { label: 'Llovizna densa',              icon: 'CloudDrizzle',   bg: 'rain'   },
  61: { label: 'Lluvia ligera',               icon: 'CloudRain',      bg: 'rain'   },
  63: { label: 'Lluvia moderada',             icon: 'CloudRain',      bg: 'rain'   },
  65: { label: 'Lluvia intensa',              icon: 'CloudRain',      bg: 'rain'   },
  71: { label: 'Nieve ligera',                icon: 'CloudSnow',      bg: 'snow'   },
  73: { label: 'Nieve moderada',              icon: 'CloudSnow',      bg: 'snow'   },
  75: { label: 'Nieve intensa',               icon: 'CloudSnow',      bg: 'snow'   },
  77: { label: 'Aguanieve',                   icon: 'CloudSnow',      bg: 'snow'   },
  80: { label: 'Chubascos ligeros',           icon: 'CloudRain',      bg: 'rain'   },
  81: { label: 'Chubascos moderados',         icon: 'CloudRain',      bg: 'rain'   },
  82: { label: 'Chubascos violentos',         icon: 'CloudLightning', bg: 'storm'  },
  85: { label: 'Nieve en chubascos',          icon: 'CloudSnow',      bg: 'snow'   },
  86: { label: 'Nieve intensa en chubascos',  icon: 'CloudSnow',      bg: 'snow'   },
  95: { label: 'Tormenta',                    icon: 'CloudLightning', bg: 'storm'  },
  96: { label: 'Tormenta con granizo',        icon: 'CloudLightning', bg: 'storm'  },
  99: { label: 'Tormenta con granizo fuerte', icon: 'CloudLightning', bg: 'storm'  },
}

export function getWeatherInfo(code) {
  return WMO_CODES[code] ?? { label: 'Desconocido', icon: 'Cloud', bg: 'clear' }
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

export function getAlert(current) {
  const temp = current.temperature_2m
  const wind = current.wind_speed_10m
  const code = current.weather_code

  if ([95, 96, 99].includes(code))
    return { msg: 'Tormenta activa. Evita zonas descubiertas y busca refugio.', level: 'danger', icon: 'Zap' }
  if (temp >= 40)
    return { msg: `Calor extremo: ${Math.round(temp)}°C. Mantente hidratado y a la sombra.`, level: 'warning', icon: 'Thermometer' }
  if (temp <= -10)
    return { msg: `Frío extremo: ${Math.round(temp)}°C. Abrígate bien y evita la exposición.`, level: 'cold', icon: 'Thermometer' }
  if (wind >= 80)
    return { msg: `Viento muy fuerte: ${Math.round(wind)} km/h. Precaución en exteriores.`, level: 'warning', icon: 'Wind' }
  return null
}

export function formatHour(isoTimeStr) {
  return isoTimeStr.slice(11, 16)
}

export function getUvInfo(uv) {
  if (uv <= 2)  return { label: 'Bajo',     color: '#4caf50' }
  if (uv <= 5)  return { label: 'Moderado', color: '#ffeb3b' }
  if (uv <= 7)  return { label: 'Alto',     color: '#ff9800' }
  if (uv <= 10) return { label: 'Muy alto', color: '#f44336' }
  return          { label: 'Extremo',   color: '#9c27b0' }
}

export function getLocalTime(timezone) {
  return new Date().toLocaleTimeString('es-ES', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatUpdatedAt(isoTime, timezone) {
  return new Date(isoTime).toLocaleTimeString('es-ES', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatSunTime(isoStr) {
  return isoStr ? isoStr.slice(11, 16) : '--:--'
}

export function getAqiInfo(value) {
  if (value == null)  return { label: 'Sin datos',        color: 'var(--text-muted)' }
  if (value <= 50)    return { label: 'Buena',            color: '#4caf50', bg: 'rgba(76,175,80,0.15)' }
  if (value <= 100)   return { label: 'Moderada',         color: '#ffeb3b', bg: 'rgba(255,235,59,0.15)' }
  if (value <= 150)   return { label: 'No saludable*',    color: '#ff9800', bg: 'rgba(255,152,0,0.15)' }
  if (value <= 200)   return { label: 'No saludable',     color: '#f44336', bg: 'rgba(244,67,54,0.15)' }
  if (value <= 300)   return { label: 'Muy no saludable', color: '#9c27b0', bg: 'rgba(156,39,176,0.15)' }
  return               { label: 'Peligrosa',             color: '#7b1fa2', bg: 'rgba(123,31,162,0.15)' }
}
