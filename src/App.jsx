import { useState } from 'react'
import {
  getWeatherInfo, getWindDirection, getDayName, formatLocation,
  getUvInfo, getLocalTime, formatUpdatedAt, getAlert, formatHour
} from './utils/weather'
import './App.css'

// ── Caché en memoria ─────────────────────────────────────
const weatherCache = new Map()
const CACHE_TTL = 10 * 60 * 1000

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

// ── Fetch weather con caché (tarea 20: +hourly) ──────────
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
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&forecast_days=2&timezone=auto`,
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

// ────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]             = useState('')
  const [weather, setWeather]         = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [history, setHistory]         = useState(loadHistory)
  const [favorites, setFavorites]     = useState(loadFavorites)
  const [hourlyOpen, setHourlyOpen]   = useState(false)

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
      const data = await fetchWeatherForLocation(fav.lat, fav.lon, fav.label)
      setWeather(data); setQuery(''); setSuggestions([])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── Search ───────────────────────────────────────────
  const applyWeather = (data, cityLabel) => {
    setWeather(data); addToHistory(cityLabel); setQuery(''); setSuggestions([])
    setHourlyOpen(false)
  }

  const searchCity = async (cityName) => {
    setLoading(true); setError(null); setSuggestions([])
    try {
      const geoResults = await fetchGeoSuggestions(cityName)
      if (geoResults.length === 1) {
        const { lat, lon, display_name } = geoResults[0]
        const data = await fetchWeatherForLocation(lat, lon, display_name)
        applyWeather(data, cityName)
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
      const data = await fetchWeatherForLocation(lat, lon, display_name)
      applyWeather(data, display_name.split(',')[0].trim())
    } catch (err) { setError(err.message); setWeather(null) }
    finally { setLoading(false) }
  }

  // ── Derived values ───────────────────────────────────
  const current = weather?.current
  const daily   = weather?.daily
  const hourly  = weather?.hourly
  const info    = current ? getWeatherInfo(current.weather_code) : null
  const alert   = current ? getAlert(current) : null

  // Próximas 24h: buscar índice de la hora actual y tomar 24 entradas
  const hourlyStartIdx = hourly ? Math.max(0, hourly.time.indexOf(weather.current.time)) : 0
  const next24 = hourly ? hourly.time.slice(hourlyStartIdx, hourlyStartIdx + 24) : []

  const starred = weather ? isFavorite(weather.latitude, weather.longitude) : false

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

          {/* Recientes + Favoritos */}
          {(history.length > 0 || favorites.length > 0) && !loading && (
            <div className="pills-area">
              {history.length > 0 && (
                <div className="pills-row" aria-label="Búsquedas recientes">
                  <span className="pills-label">Recientes</span>
                  {history.map(city => (
                    <button key={city} type="button" className="history-pill" onClick={() => searchCity(city)}>
                      {city}
                    </button>
                  ))}
                </div>
              )}
              {favorites.length > 0 && (
                <div className="pills-row" aria-label="Ciudades favoritas">
                  <span className="pills-label">Favoritos</span>
                  {favorites.map(fav => (
                    <button key={`${fav.lat},${fav.lon}`} type="button" className="history-pill fav-pill" onClick={() => searchFavorite(fav)}>
                      ⭐ {fav.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Selector de ciudad */}
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
            <span className="placeholder-emoji" aria-hidden="true">🌍</span>
            <p>Escribe una ciudad para ver el tiempo</p>
          </div>
        )}

        {weather && !loading && (
          <main className="dashboard">

            {/* Alert banner (tarea 19) */}
            {alert && (
              <div className={`alert-banner alert-${alert.level}`} role="alert">
                {alert.msg}
              </div>
            )}

            {/* Location bar con favorito (tareas 13, 14, 21) */}
            <div className="location-bar">
              <div className="location-left">
                <span className="location-name">📍 {formatLocation(weather.location)}</span>
                <button
                  type="button"
                  className={`fav-btn ${starred ? 'fav-btn--active' : ''}`}
                  onClick={toggleFavorite}
                  aria-label={starred ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                >
                  {starred ? '⭐' : '☆'}
                </button>
              </div>
              <span className="location-meta">
                🕐 {getLocalTime(weather.timezone)}
                <span className="separator">·</span>
                Actualizado a las {formatUpdatedAt(weather.current.time, weather.timezone)}
              </span>
            </div>

            {/* Main card */}
            <div className="main-card" aria-label={`${info.label}, ${Math.round(current.temperature_2m)} grados`}>
              <span className="weather-emoji" aria-hidden="true">{info.emoji}</span>
              <div className="temp-block">
                <span className="temperature">{Math.round(current.temperature_2m)}°C</span>
                <span className="condition">{info.label}</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
              <div className="metric-card" aria-label={`Sensación térmica: ${Math.round(current.apparent_temperature)} grados`}>
                <span className="metric-icon" aria-hidden="true">🌡️</span>
                <span className="metric-label">Sensación</span>
                <span className="metric-value">{Math.round(current.apparent_temperature)}°C</span>
              </div>
              <div className="metric-card" aria-label={`Humedad: ${current.relative_humidity_2m} por ciento`}>
                <span className="metric-icon" aria-hidden="true">💧</span>
                <span className="metric-label">Humedad</span>
                <span className="metric-value">{current.relative_humidity_2m}%</span>
              </div>
              <div className="metric-card" aria-label={`Viento: ${Math.round(current.wind_speed_10m)} km/h dirección ${getWindDirection(current.wind_direction_10m)}`}>
                <span className="metric-icon" aria-hidden="true">💨</span>
                <span className="metric-label">Viento</span>
                <span className="metric-value">{Math.round(current.wind_speed_10m)} km/h {getWindDirection(current.wind_direction_10m)}</span>
              </div>
              {(() => {
                const uv = Math.round(current.uv_index ?? 0)
                const uvInfo = getUvInfo(uv)
                return (
                  <div className="metric-card" aria-label={`Índice UV: ${uv}, riesgo ${uvInfo.label}`}>
                    <span className="metric-icon" aria-hidden="true">🔆</span>
                    <span className="metric-label">Índice UV</span>
                    <span className="metric-value">{uv}</span>
                    <span className="uv-badge" style={{ color: uvInfo.color }}>{uvInfo.label}</span>
                  </div>
                )
              })()}
            </div>

            {/* Previsión horaria 24h (tarea 20) */}
            {next24.length > 0 && (
              <div className="hourly-section">
                <button
                  type="button"
                  className="hourly-toggle"
                  onClick={() => setHourlyOpen(o => !o)}
                  aria-expanded={hourlyOpen}
                >
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
                          <span className="hourly-emoji" aria-hidden="true">{hInfo.emoji}</span>
                          <span className="hourly-temp">{Math.round(hourly.temperature_2m[idx])}°</span>
                          <span className="hourly-rain">💧{hourly.precipitation_probability[idx] ?? 0}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 7-day forecast */}
            <div className="forecast">
              <h2>Próximos 7 días</h2>
              <div className="forecast-list">
                {daily.time.map((day, i) => {
                  const dayInfo = getWeatherInfo(daily.weather_code[i])
                  return (
                    <div
                      key={day}
                      className="forecast-day"
                      aria-label={`${i === 0 ? 'Hoy' : getDayName(day)}: ${dayInfo.label}, máxima ${Math.round(daily.temperature_2m_max[i])} grados, mínima ${Math.round(daily.temperature_2m_min[i])} grados, lluvia ${daily.precipitation_probability_max[i] ?? 0}%`}
                    >
                      <span className="day-name">{i === 0 ? 'Hoy' : getDayName(day)}</span>
                      <span className="day-emoji" aria-hidden="true">{dayInfo.emoji}</span>
                      <span className="day-rain" aria-hidden="true">💧 {daily.precipitation_probability_max[i] ?? 0}%</span>
                      <div className="day-temps" aria-hidden="true">
                        <span className="day-max">{Math.round(daily.temperature_2m_max[i])}°</span>
                        <span className="day-min">{Math.round(daily.temperature_2m_min[i])}°</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </main>
        )}

        {/* Attribution footer (tarea 22) */}
        <footer className="attribution">
          Datos: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          <span className="separator">·</span>
          Geocodificación: <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noopener noreferrer">Nominatim / OpenStreetMap</a>
        </footer>

      </div>
    </div>
  )
}
