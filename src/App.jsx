import { useState } from 'react'
import { getWeatherInfo, getWindDirection, getDayName, formatLocation } from './utils/weather'
import './App.css'

// ── Caché en memoria (tarea 10) ──────────────────────────
const weatherCache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutos

// ── Historial en localStorage (tarea 9) ─────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('wb_history') ?? '[]') }
  catch { return [] }
}
function saveHistory(list) {
  localStorage.setItem('wb_history', JSON.stringify(list))
}

// ── Fetch geo: devuelve hasta 5 resultados (tarea 11) ────
async function fetchGeoSuggestions(locationName) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=5`,
    { headers: { 'Accept-Language': 'es' } }
  ).catch(() => { throw new Error('Sin conexión a Internet. Comprueba tu red.') })

  const data = await res.json().catch(() => {
    throw new Error('Respuesta inesperada al buscar la ciudad. Inténtalo de nuevo.')
  })

  if (!data.length) {
    throw new Error(`Ciudad no encontrada. Prueba añadiendo el país (ej: "${locationName}, España").`)
  }
  return data
}

// ── Fetch weather con caché ──────────────────────────────
async function fetchWeatherForLocation(lat, lon, displayName) {
  const cacheKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto`
  ).catch(() => { throw new Error('Sin conexión a Internet. Comprueba tu red.') })

  if (!weatherRes.ok) {
    throw new Error('El servicio meteorológico no está disponible. Inténtalo en unos minutos.')
  }

  const weatherData = await weatherRes.json().catch(() => {
    throw new Error('Error al leer los datos meteorológicos. Inténtalo de nuevo.')
  })

  const result = { location: displayName, ...weatherData }
  weatherCache.set(cacheKey, { data: result, ts: Date.now() })
  return result
}

// ────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]           = useState('')
  const [weather, setWeather]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [history, setHistory]       = useState(loadHistory)

  const addToHistory = (cityName) => {
    const next = [cityName, ...history.filter(h => h !== cityName)].slice(0, 5)
    setHistory(next)
    saveHistory(next)
  }

  const applyWeather = (data, cityLabel) => {
    setWeather(data)
    addToHistory(cityLabel)
    setQuery('')
    setSuggestions([])
  }

  const searchCity = async (cityName) => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    try {
      const geoResults = await fetchGeoSuggestions(cityName)
      if (geoResults.length === 1) {
        const { lat, lon, display_name } = geoResults[0]
        const data = await fetchWeatherForLocation(lat, lon, display_name)
        applyWeather(data, cityName)
      } else {
        // Múltiples ciudades → mostrar selector (tarea 11)
        setSuggestions(geoResults)
      }
    } catch (err) {
      setError(err.message)
      setWeather(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    searchCity(query.trim())
  }

  const handleSelectSuggestion = async (suggestion) => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    try {
      const { lat, lon, display_name } = suggestion
      const data = await fetchWeatherForLocation(lat, lon, display_name)
      const cityLabel = display_name.split(',')[0].trim()
      applyWeather(data, cityLabel)
    } catch (err) {
      setError(err.message)
      setWeather(null)
    } finally {
      setLoading(false)
    }
  }

  const current = weather?.current
  const daily   = weather?.daily
  const info    = current ? getWeatherInfo(current.weather_code) : null

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
              {loading
                ? <span className="spinner" aria-label="Cargando" role="status" />
                : 'Buscar'
              }
            </button>
          </form>

          {/* Historial de búsquedas (tarea 9) */}
          {history.length > 0 && !loading && (
            <div className="search-history" aria-label="Búsquedas recientes">
              {history.map(city => (
                <button
                  key={city}
                  type="button"
                  className="history-pill"
                  onClick={() => searchCity(city)}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Selector de ciudad (tarea 11) */}
        {suggestions.length > 0 && (
          <div className="suggestions-box" role="listbox" aria-label="Selecciona una ubicación">
            <p className="suggestions-title">¿A cuál te refieres?</p>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="suggestion-item"
                role="option"
                onClick={() => handleSelectSuggestion(s)}
              >
                <span className="suggestion-name">
                  {s.display_name.split(',').slice(0, 2).join(',').trim()}
                </span>
                <span className="suggestion-detail">
                  {s.display_name.split(',').slice(2, 4).join(',').trim()}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="error-msg" role="alert" aria-live="assertive">
            ⚠️ {error}
          </div>
        )}

        {!weather && !loading && !error && suggestions.length === 0 && (
          <div className="placeholder">
            <span className="placeholder-emoji" aria-hidden="true">🌍</span>
            <p>Escribe una ciudad para ver el tiempo</p>
          </div>
        )}

        {weather && !loading && (
          <main className="dashboard">
            <p className="location-name">📍 {formatLocation(weather.location)}</p>

            <div
              className="main-card"
              aria-label={`${info.label}, ${Math.round(current.temperature_2m)} grados`}
            >
              <span className="weather-emoji" aria-hidden="true">{info.emoji}</span>
              <div className="temp-block">
                <span className="temperature">{Math.round(current.temperature_2m)}°C</span>
                <span className="condition">{info.label}</span>
              </div>
            </div>

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
              <div className="metric-card" aria-label={`Viento: ${Math.round(current.wind_speed_10m)} kilómetros por hora, dirección ${getWindDirection(current.wind_direction_10m)}`}>
                <span className="metric-icon" aria-hidden="true">💨</span>
                <span className="metric-label">Viento</span>
                <span className="metric-value">
                  {Math.round(current.wind_speed_10m)} km/h {getWindDirection(current.wind_direction_10m)}
                </span>
              </div>
              <div className="metric-card" aria-label={`Índice UV: ${Math.round(current.uv_index ?? 0)}`}>
                <span className="metric-icon" aria-hidden="true">🔆</span>
                <span className="metric-label">Índice UV</span>
                <span className="metric-value">{Math.round(current.uv_index ?? 0)}</span>
              </div>
            </div>

            <div className="forecast">
              <h2>Próximos 7 días</h2>
              <div className="forecast-list">
                {daily.time.map((day, i) => {
                  const dayInfo = getWeatherInfo(daily.weather_code[i])
                  return (
                    <div
                      key={day}
                      className="forecast-day"
                      aria-label={`${i === 0 ? 'Hoy' : getDayName(day)}: ${dayInfo.label}, máxima ${Math.round(daily.temperature_2m_max[i])} grados, mínima ${Math.round(daily.temperature_2m_min[i])} grados, probabilidad de lluvia ${daily.precipitation_probability_max[i] ?? 0} por ciento`}
                    >
                      <span className="day-name">{i === 0 ? 'Hoy' : getDayName(day)}</span>
                      <span className="day-emoji" aria-hidden="true">{dayInfo.emoji}</span>
                      <span className="day-rain" aria-hidden="true">
                        💧 {daily.precipitation_probability_max[i] ?? 0}%
                      </span>
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

      </div>
    </div>
  )
}
