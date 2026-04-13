import { useState, useEffect, useRef } from 'react'
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
  MapPin, Clock, Star, Globe, Sunrise, Sunset, Leaf, Droplets, Thermometer, Wind, Zap,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import {
  getWeatherInfo, getWindDirection, getDayName, formatLocation,
  getUvInfo, getLocalTime, formatUpdatedAt, getAlert, formatHour,
  formatSunTime, getAqiInfo
} from './utils/weather'
import './App.css'

// ── Leaflet icon fix for Vite ────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
})

// ── Caché en memoria ─────────────────────────────────────
const weatherCache = new Map()
const aqiCache     = new Map()
const CACHE_TTL    = 10 * 60 * 1000

// ── localStorage helpers ─────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('wb_history') ?? '[]') } catch { return [] }
}
function saveHistory(list) { localStorage.setItem('wb_history', JSON.stringify(list)) }

function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('wb_favorites') ?? '[]') } catch { return [] }
}
function saveFavorites(list) { localStorage.setItem('wb_favorites', JSON.stringify(list)) }

// ── Fetch geo ────────────────────────────────────────────
async function fetchGeoSuggestions(locationName) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  let res
  try {
    res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=5`,
      { headers: { 'Accept-Language': 'es' }, signal: controller.signal }
    )
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'La búsqueda tardó demasiado. Comprueba tu conexión.'
      : 'Sin conexión a Internet. Comprueba tu red.')
  } finally { clearTimeout(timeout) }

  if (!res.ok) throw new Error(`Error del servicio de geocodificación (${res.status}). Inténtalo de nuevo.`)
  const data = await res.json().catch(() => { throw new Error('Respuesta inesperada. Inténtalo de nuevo.') })
  if (!data.length) throw new Error(`Ciudad no encontrada. Prueba añadiendo el país (ej: "${locationName}, España").`)
  return data
}

// ── Fetch weather con caché ───────────────────────────────
async function fetchWeatherForLocation(lat, lon, displayName) {
  const cacheKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  let weatherRes
  try {
    weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
      `&forecast_days=7&timezone=auto`,
      { signal: controller.signal }
    )
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'La petición tardó demasiado. Inténtalo de nuevo.'
      : 'Sin conexión a Internet. Comprueba tu red.')
  } finally { clearTimeout(timeout) }

  if (!weatherRes.ok) throw new Error(`Servicio no disponible (${weatherRes.status}). Inténtalo en unos minutos.`)
  const weatherData = await weatherRes.json().catch(() => { throw new Error('Error al leer los datos. Inténtalo de nuevo.') })
  if (!weatherData?.current || !weatherData?.daily?.time?.length) throw new Error('Datos incompletos. Inténtalo de nuevo.')

  const result = { location: displayName, ...weatherData }
  weatherCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

// ── Fetch AQI con caché (fallo silencioso) ────────────────
async function fetchAqiForLocation(lat, lon) {
  const cacheKey = `aqi-${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`
  const cached = aqiCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let res
    try {
      res = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto&forecast_days=1`,
        { signal: controller.signal }
      )
    } finally { clearTimeout(timeout) }
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data?.hourly?.us_aqi?.length) return null
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const currentHour = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`
    const idx = data.hourly.time.indexOf(currentHour)
    const value = idx >= 0 ? data.hourly.us_aqi[idx] : data.hourly.us_aqi[0]
    const result = { value }
    aqiCache.set(cacheKey, { data: result, ts: Date.now() })
    return result
  } catch {
    return null
  }
}

// ── Coordinator: weather + AQI en paralelo ────────────────
async function loadWeatherAndAqi(lat, lon, displayName) {
  const [weatherResult, aqiResult] = await Promise.allSettled([
    fetchWeatherForLocation(lat, lon, displayName),
    fetchAqiForLocation(lat, lon),
  ])
  if (weatherResult.status === 'rejected') throw weatherResult.reason
  return {
    weather: weatherResult.value,
    aqi: aqiResult.status === 'fulfilled' ? aqiResult.value : null,
  }
}

// ── Nearby helpers (module level) ────────────────────────
function getNearbyPoints(lat, lon) {
  const latRad = lat * Math.PI / 180
  const dLat = 80 / 111
  const dLon = 80 / (111 * Math.cos(latRad))
  const d45  = dLat / Math.SQRT2
  const d45L = dLon / Math.SQRT2
  return [
    { lat: lat + dLat, lon,           dir: 'N'  },
    { lat: lat + d45,  lon: lon+d45L, dir: 'NE' },
    { lat,             lon: lon+dLon, dir: 'E'  },
    { lat: lat - d45,  lon: lon+d45L, dir: 'SE' },
    { lat: lat - dLat, lon,           dir: 'S'  },
    { lat: lat - d45,  lon: lon-d45L, dir: 'SO' },
    { lat,             lon: lon-dLon, dir: 'O'  },
    { lat: lat + d45,  lon: lon-d45L, dir: 'NO' },
  ]
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=10`,
      { headers: { 'Accept-Language': 'es' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.address?.city || data.address?.town || data.address?.village || data.address?.county || null
  } catch { return null }
}

// ── Weather icon component ────────────────────────────────
const W_ICONS = { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning }
function WeatherIcon({ name, size = 24, className = '' }) {
  const I = W_ICONS[name] ?? Cloud
  return <I size={size} className={className} strokeWidth={1.5} />
}

// ── Alert icon component ──────────────────────────────────
const A_ICONS = { Zap, Thermometer, Wind }
function AlertIcon({ name, size = 16 }) {
  const I = A_ICONS[name] ?? Zap
  return <I size={size} strokeWidth={2} />
}

// ── TempChart component ───────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.stroke, margin: '2px 0' }}>
          {p.name === 'Temp' ? `${p.value}°C` : `${p.value}%`}
        </p>
      ))}
    </div>
  )
}

function TempChart({ data }) {
  if (!data.length) return null
  const temps   = data.map(d => d.temp)
  const minTemp = Math.min(...temps) - 2
  const maxTemp = Math.max(...temps) + 2
  return (
    <div className="chart-section">
      <h2>Temperatura próximas 24h</h2>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="rgba(255,255,255,0.5)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(255,255,255,0.1)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="rgba(100,160,255,0.5)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(100,160,255,0.1)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
            <YAxis domain={[minTemp, maxTemp]} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}°`} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="temp" stroke="rgba(255,255,255,0.9)" strokeWidth={2}   fill="url(#tempGrad)" name="Temp"   />
            <Area type="monotone" dataKey="rain" stroke="rgba(100,160,255,0.8)" strokeWidth={1.5} fill="url(#rainGrad)" name="Lluvia" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── WeatherMap component ──────────────────────────────────
function WeatherMap({ lat, lon, cityName }) {
  return (
    <div className="map-section">
      <h2>Ubicación</h2>
      <div className="map-wrapper">
        <MapContainer key={`${lat},${lon}`} center={[lat, lon]} zoom={11} scrollWheelZoom={false} className="leaflet-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lon]}>
            <Popup>{cityName}</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}

// ── Filter config ─────────────────────────────────────────
const NEARBY_FILTERS = [
  { key: 'all',   label: 'Todos' },
  { key: 'clear', label: 'Despejado',  icon: 'Sun'            },
  { key: 'cloudy',label: 'Nublado',    icon: 'Cloud'          },
  { key: 'rain',  label: 'Lluvia',     icon: 'CloudRain'      },
  { key: 'snow',  label: 'Nieve',      icon: 'CloudSnow'      },
  { key: 'storm', label: 'Tormenta',   icon: 'CloudLightning' },
]
const FILTER_EMPTY = {
  all: 'tiempo cercano', clear: 'cielo despejado', cloudy: 'cielo nublado',
  rain: 'lluvia', snow: 'nieve', storm: 'tormentas',
}

// ────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]             = useState('')
  const [weather, setWeather]         = useState(null)
  const [aqi, setAqi]                 = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [history, setHistory]         = useState(loadHistory)
  const [favorites, setFavorites]     = useState(loadFavorites)
  const [hourlyOpen, setHourlyOpen]   = useState(false)
  const [nearbyWeather, setNearbyWeather] = useState([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyFilter, setNearbyFilter]   = useState('all')
  const nearbyGenRef = useRef(0)

  // ── History ──────────────────────────────────────────
  const addToHistory = (cityName) => {
    const next = [cityName, ...history.filter(h => h !== cityName)].slice(0, 5)
    setHistory(next); saveHistory(next)
  }

  // ── Favorites ────────────────────────────────────────
  const isFavorite = (lat, lon) =>
    favorites.some(f => f.lat === String(lat) && f.lon === String(lon))

  const toggleFavorite = () => {
    if (!weather) return
    const { latitude: lat, longitude: lon, location } = weather
    const label = formatLocation(location).split(',')[0].trim()
    if (isFavorite(lat, lon)) {
      const next = favorites.filter(f => !(f.lat === String(lat) && f.lon === String(lon)))
      setFavorites(next); saveFavorites(next)
    } else {
      const next = [{ label, lat: String(lat), lon: String(lon) }, ...favorites].slice(0, 8)
      setFavorites(next); saveFavorites(next)
    }
  }

  const searchFavorite = async (fav) => {
    setLoading(true); setError(null); setSuggestions([])
    try {
      const { weather: data, aqi: aqiData } = await loadWeatherAndAqi(fav.lat, fav.lon, fav.label)
      setWeather(data); setAqi(aqiData); setQuery(''); setSuggestions([])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── Search ───────────────────────────────────────────
  const applyWeather = (data, aqiData, cityLabel) => {
    setWeather(data); setAqi(aqiData); addToHistory(cityLabel); setQuery(''); setSuggestions([])
    setHourlyOpen(false)
  }

  const searchCity = async (cityName) => {
    setLoading(true); setError(null); setSuggestions([])
    try {
      const geoResults = await fetchGeoSuggestions(cityName)
      if (geoResults.length === 1) {
        const { lat, lon, display_name } = geoResults[0]
        const { weather: data, aqi: aqiData } = await loadWeatherAndAqi(lat, lon, display_name)
        applyWeather(data, aqiData, cityName)
      } else {
        setSuggestions(geoResults)
      }
    } catch (err) { setError(err.message); setWeather(null) }
    finally { setLoading(false) }
  }

  const handleSearch = (e) => { e.preventDefault(); if (query.trim()) searchCity(query.trim()) }

  const handleSelectSuggestion = async (suggestion) => {
    setLoading(true); setError(null); setSuggestions([])
    try {
      const { lat, lon, display_name } = suggestion
      const { weather: data, aqi: aqiData } = await loadWeatherAndAqi(lat, lon, display_name)
      applyWeather(data, aqiData, display_name.split(',')[0].trim())
    } catch (err) { setError(err.message); setWeather(null) }
    finally { setLoading(false) }
  }

  // ── Nearby weather ───────────────────────────────────
  const fetchNearbyWeather = async (lat, lon) => {
    const gen = ++nearbyGenRef.current
    setNearbyWeather([])
    setNearbyLoading(true)
    setNearbyFilter('all')

    const points = getNearbyPoints(lat, lon)
    const results = await Promise.allSettled(
      points.map(p => fetchWeatherForLocation(p.lat.toFixed(4), p.lon.toFixed(4), p.dir))
    )
    if (nearbyGenRef.current !== gen) return

    const items = points
      .map((p, i) => ({
        lat: p.lat, lon: p.lon, dir: p.dir, cityName: p.dir,
        weather: results[i].status === 'fulfilled' ? results[i].value : null,
        info:    results[i].status === 'fulfilled'
          ? getWeatherInfo(results[i].value.current.weather_code) : null,
      }))
      .filter(item => item.weather && item.info)

    setNearbyWeather(items)
    setNearbyLoading(false)

    // Lazily resolve city names via reverse geocoding
    for (let i = 0; i < items.length; i++) {
      if (nearbyGenRef.current !== gen) return
      const name = await reverseGeocode(items[i].lat, items[i].lon)
      if (name) setNearbyWeather(prev => prev.map((x, j) => j === i ? { ...x, cityName: name } : x))
      await new Promise(r => setTimeout(r, 150))
    }
  }

  const selectNearby = async (item) => {
    setLoading(true); setError(null); setSuggestions([])
    try {
      const { weather: data, aqi: aqiData } = await loadWeatherAndAqi(
        item.lat.toFixed(4), item.lon.toFixed(4), item.cityName
      )
      applyWeather({ ...data, location: item.cityName }, aqiData, item.cityName)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (weather) fetchNearbyWeather(weather.latitude, weather.longitude)
    else setNearbyWeather([])
  }, [weather])

  // ── Derived values ───────────────────────────────────
  const current = weather?.current
  const daily   = weather?.daily
  const hourly  = weather?.hourly
  const info    = current ? getWeatherInfo(current.weather_code) : null
  const alert   = current ? getAlert(current) : null

  const hourlyStartIdx = hourly ? Math.max(0, hourly.time.indexOf(weather.current.time)) : 0
  const next24 = hourly ? hourly.time.slice(hourlyStartIdx, hourlyStartIdx + 24) : []

  const starred   = weather ? isFavorite(weather.latitude, weather.longitude) : false
  const aqiInfo   = aqi?.value != null ? getAqiInfo(aqi.value) : null
  const chartData = hourly && next24.length > 0
    ? next24.map((t, i) => ({
        hour: formatHour(t),
        temp: Math.round(hourly.temperature_2m[hourlyStartIdx + i]),
        rain: hourly.precipitation_probability[hourlyStartIdx + i] ?? 0,
      }))
    : []

  const filteredNearby = nearbyFilter === 'all'
    ? nearbyWeather
    : nearbyWeather.filter(item => item.info?.bg === nearbyFilter)

  return (
    <div className={`app ${info?.bg ?? ''}`}>
      <div className="container">

        <header>
          <h1>WeatherBoard</h1>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Escribe una ciudad..."
              className="search-input"
              aria-label="Buscar ciudad"
              disabled={loading}
              autoFocus
            />
            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? <span className="spinner" aria-label="Cargando" role="status" /> : 'Buscar'}
            </button>
          </form>

          {(history.length > 0 || favorites.length > 0) && !loading && (
            <div className="pills-area">
              {history.length > 0 && (
                <div className="pills-row" aria-label="Búsquedas recientes">
                  <span className="pills-label">Recientes</span>
                  {history.map(city => (
                    <button key={city} type="button" className="history-pill" onClick={() => searchCity(city)}>{city}</button>
                  ))}
                </div>
              )}
              {favorites.length > 0 && (
                <div className="pills-row" aria-label="Ciudades favoritas">
                  <span className="pills-label">Favoritos</span>
                  {favorites.map(fav => (
                    <button key={`${fav.lat},${fav.lon}`} type="button" className="history-pill fav-pill" onClick={() => searchFavorite(fav)}>
                      <Star size={11} className="fav-pill-star" />{fav.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {suggestions.length > 0 && (
          <div className="suggestions-box" role="listbox" aria-label="Selecciona una ubicación">
            <p className="suggestions-title">¿A cuál te refieres?</p>
            {suggestions.map((s, i) => (
              <button key={i} type="button" className="suggestion-item" role="option" onClick={() => handleSelectSuggestion(s)}>
                <span className="suggestion-name">{s.display_name.split(',').slice(0, 2).join(',').trim()}</span>
                <span className="suggestion-detail">{s.display_name.split(',').slice(2, 4).join(',').trim()}</span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="error-msg" role="alert" aria-live="assertive">⚠️ {error}</div>}

        {!weather && !loading && !error && suggestions.length === 0 && (
          <div className="placeholder">
            <Globe size={72} className="placeholder-icon" strokeWidth={1} />
            <p>Escribe una ciudad para ver el tiempo</p>
          </div>
        )}

        {weather && !loading && (
          <main className="dashboard">

            {alert && (
              <div className={`alert-banner alert-${alert.level}`} role="alert">
                <AlertIcon name={alert.icon} size={16} />
                {alert.msg}
              </div>
            )}

            <div className="location-bar">
              <div className="location-left">
                <span className="location-name">
                  <MapPin size={14} strokeWidth={2} />
                  {formatLocation(weather.location)}
                </span>
                <button
                  type="button"
                  className={`fav-btn ${starred ? 'fav-btn--active' : ''}`}
                  onClick={toggleFavorite}
                  aria-label={starred ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                >
                  <Star size={17} strokeWidth={2} />
                </button>
              </div>
              <span className="location-meta">
                <Clock size={12} strokeWidth={2} />
                {getLocalTime(weather.timezone)}
                <span className="separator">·</span>
                Actualizado a las {formatUpdatedAt(weather.current.time, weather.timezone)}
              </span>
            </div>

            <div className="main-card" aria-label={`${info.label}, ${Math.round(current.temperature_2m)} grados`}>
              <span className="weather-emoji" aria-hidden="true">
                <WeatherIcon name={info.icon} size={88} />
              </span>
              <div className="temp-block">
                <span className="temperature">{Math.round(current.temperature_2m)}°C</span>
                <span className="condition">{info.label}</span>
              </div>
            </div>

            {daily?.sunrise?.[0] && (
              <div className="sun-row">
                <div className="sun-card">
                  <span className="sun-icon"><Sunrise size={28} strokeWidth={1.5} /></span>
                  <span className="sun-label">Amanecer</span>
                  <span className="sun-time">{formatSunTime(daily.sunrise[0])}</span>
                </div>
                <div className="sun-card">
                  <span className="sun-icon"><Sunset size={28} strokeWidth={1.5} /></span>
                  <span className="sun-label">Atardecer</span>
                  <span className="sun-time">{formatSunTime(daily.sunset[0])}</span>
                </div>
              </div>
            )}

            <div className="metrics-grid">
              <div className="metric-card" aria-label={`Sensación térmica: ${Math.round(current.apparent_temperature)} grados`}>
                <span className="metric-icon"><Thermometer size={22} strokeWidth={1.5} /></span>
                <span className="metric-label">Sensación</span>
                <span className="metric-value">{Math.round(current.apparent_temperature)}°C</span>
              </div>
              <div className="metric-card" aria-label={`Humedad: ${current.relative_humidity_2m} por ciento`}>
                <span className="metric-icon"><Droplets size={22} strokeWidth={1.5} /></span>
                <span className="metric-label">Humedad</span>
                <span className="metric-value">{current.relative_humidity_2m}%</span>
              </div>
              <div className="metric-card" aria-label={`Viento: ${Math.round(current.wind_speed_10m)} km/h`}>
                <span className="metric-icon"><Wind size={22} strokeWidth={1.5} /></span>
                <span className="metric-label">Viento</span>
                <span className="metric-value">{Math.round(current.wind_speed_10m)} km/h {getWindDirection(current.wind_direction_10m)}</span>
              </div>
              {(() => {
                const uv = Math.round(current.uv_index ?? 0)
                const uvInfo = getUvInfo(uv)
                return (
                  <div className="metric-card" aria-label={`Índice UV: ${uv}, riesgo ${uvInfo.label}`}>
                    <span className="metric-icon"><Sun size={22} strokeWidth={1.5} /></span>
                    <span className="metric-label">Índice UV</span>
                    <span className="metric-value">{uv}</span>
                    <span className="uv-badge" style={{ color: uvInfo.color }}>{uvInfo.label}</span>
                  </div>
                )
              })()}
            </div>

            {aqiInfo && aqi?.value != null && (
              <div className="aqi-section">
                <div className="aqi-card">
                  <div className="aqi-header">
                    <span className="aqi-title">
                      <Leaf size={14} strokeWidth={2} />Calidad del aire
                    </span>
                    <span className="aqi-badge" style={{ color: aqiInfo.color, background: aqiInfo.bg }}>{aqiInfo.label}</span>
                    <span className="aqi-num">{aqi.value} AQI</span>
                  </div>
                  <div className="aqi-bar-track">
                    <div className="aqi-bar-fill" style={{ width: `${Math.min(100, (aqi.value / 300) * 100)}%`, background: aqiInfo.color }} />
                  </div>
                </div>
              </div>
            )}

            {next24.length > 0 && (
              <div className="hourly-section">
                <button type="button" className="hourly-toggle" onClick={() => setHourlyOpen(o => !o)} aria-expanded={hourlyOpen}>
                  <span>Próximas 24 horas</span>
                  <span className="toggle-arrow">{hourlyOpen ? '▲' : '▼'}</span>
                </button>
                {hourlyOpen && (
                  <div className="hourly-list" role="list">
                    {next24.map((t, i) => {
                      const idx = hourlyStartIdx + i
                      const hInfo = getWeatherInfo(hourly.weather_code[idx])
                      return (
                        <div key={t} className="hourly-item" role="listitem">
                          <span className="hourly-time">{formatHour(t)}</span>
                          <span className="hourly-emoji"><WeatherIcon name={hInfo.icon} size={20} /></span>
                          <span className="hourly-temp">{Math.round(hourly.temperature_2m[idx])}°</span>
                          <span className="hourly-rain"><Droplets size={11} strokeWidth={2} />{hourly.precipitation_probability[idx] ?? 0}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {chartData.length > 0 && <TempChart data={chartData} />}

            <div className="forecast">
              <h2>Próximos 7 días</h2>
              <div className="forecast-list">
                {daily.time.map((day, i) => {
                  const dayInfo = getWeatherInfo(daily.weather_code[i])
                  return (
                    <div key={day} className="forecast-day"
                      aria-label={`${i === 0 ? 'Hoy' : getDayName(day)}: ${dayInfo.label}, máx ${Math.round(daily.temperature_2m_max[i])}°, mín ${Math.round(daily.temperature_2m_min[i])}°`}
                    >
                      <span className="day-name">{i === 0 ? 'Hoy' : getDayName(day)}</span>
                      <span className="day-emoji"><WeatherIcon name={dayInfo.icon} size={22} /></span>
                      <span className="day-rain"><Droplets size={13} strokeWidth={2} />{daily.precipitation_probability_max[i] ?? 0}%</span>
                      <div className="day-temps">
                        <span className="day-max">{Math.round(daily.temperature_2m_max[i])}°</span>
                        <span className="day-min">{Math.round(daily.temperature_2m_min[i])}°</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tiempo en los alrededores */}
            {(nearbyWeather.length > 0 || nearbyLoading) && (
              <div className="nearby-section">
                <h2>Tiempo en los alrededores</h2>

                {nearbyWeather.length > 0 && (
                  <div className="nearby-filters">
                    {NEARBY_FILTERS.map(f => {
                      const count = f.key === 'all'
                        ? nearbyWeather.length
                        : nearbyWeather.filter(x => x.info?.bg === f.key).length
                      if (count === 0 && f.key !== 'all') return null
                      return (
                        <button
                          key={f.key}
                          type="button"
                          className={`nearby-filter${nearbyFilter === f.key ? ' nearby-filter--active' : ''}`}
                          onClick={() => setNearbyFilter(f.key)}
                        >
                          {f.icon && <WeatherIcon name={f.icon} size={13} />}
                          {f.label}
                          <span className="nearby-filter-count">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {nearbyLoading && nearbyWeather.length === 0 ? (
                  <div className="nearby-loading">
                    <span className="spinner" />
                    Buscando tiempo cercano...
                  </div>
                ) : filteredNearby.length === 0 ? (
                  <p className="nearby-empty">No hay {FILTER_EMPTY[nearbyFilter]} en los alrededores</p>
                ) : (
                  <div className="nearby-list">
                    {filteredNearby.map((item, i) => (
                      <button
                        key={`${item.dir}-${i}`}
                        type="button"
                        className="nearby-card"
                        onClick={() => selectNearby(item)}
                      >
                        <WeatherIcon name={item.info.icon} size={30} />
                        <span className="nearby-city">{item.cityName}</span>
                        <span className="nearby-temp">{Math.round(item.weather.current.temperature_2m)}°</span>
                        <span className="nearby-condition">{item.info.label}</span>
                        <span className="nearby-dir">{item.dir}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <WeatherMap
              lat={weather.latitude}
              lon={weather.longitude}
              cityName={formatLocation(weather.location).split(',')[0].trim()}
            />

          </main>
        )}

        <footer className="attribution">
          Datos: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          <span className="separator">·</span>
          Geocodificación: <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noopener noreferrer">Nominatim / OpenStreetMap</a>
        </footer>

      </div>
    </div>
  )
}
