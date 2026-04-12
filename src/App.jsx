import { useState } from 'react'
import { getWeatherInfo, getWindDirection, getDayName, formatLocation } from './utils/weather'
import './App.css'

async function fetchWeather(locationName) {
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'es' } }
  )
  const geoData = await geoRes.json()
  if (!geoData.length) throw new Error('No se encontró la ubicación')

  const { lat, lon, display_name } = geoData[0]

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto`
  )
  if (!weatherRes.ok) throw new Error('Error al obtener los datos del tiempo')
  const weatherData = await weatherRes.json()

  return { location: display_name, ...weatherData }
}

export default function App() {
  const [query, setQuery]     = useState('')
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWeather(query.trim())
      setWeather(data)
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
              autoFocus
            />
            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Buscar'}
            </button>
          </form>
        </header>

        {error && <div className="error-msg">⚠️ {error}</div>}

        {!weather && !loading && !error && (
          <div className="placeholder">
            <span className="placeholder-emoji">🌍</span>
            <p>Escribe una ciudad para ver el tiempo</p>
          </div>
        )}

        {weather && !loading && (
          <main className="dashboard">
            <p className="location-name">📍 {formatLocation(weather.location)}</p>

            <div className="main-card">
              <span className="weather-emoji">{info.emoji}</span>
              <div className="temp-block">
                <span className="temperature">{Math.round(current.temperature_2m)}°C</span>
                <span className="condition">{info.label}</span>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-icon">🌡️</span>
                <span className="metric-label">Sensación</span>
                <span className="metric-value">{Math.round(current.apparent_temperature)}°C</span>
              </div>
              <div className="metric-card">
                <span className="metric-icon">💧</span>
                <span className="metric-label">Humedad</span>
                <span className="metric-value">{current.relative_humidity_2m}%</span>
              </div>
              <div className="metric-card">
                <span className="metric-icon">💨</span>
                <span className="metric-label">Viento</span>
                <span className="metric-value">
                  {Math.round(current.wind_speed_10m)} km/h {getWindDirection(current.wind_direction_10m)}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-icon">🔆</span>
                <span className="metric-label">Índice UV</span>
                <span className="metric-value">{Math.round(current.uv_index ?? 0)}</span>
              </div>
            </div>

            <div className="forecast">
              <h2>Próximos 7 días</h2>
              <div className="forecast-list">
                {daily.time.map((day, i) => (
                  <div key={day} className="forecast-day">
                    <span className="day-name">{i === 0 ? 'Hoy' : getDayName(day)}</span>
                    <span className="day-emoji">{getWeatherInfo(daily.weather_code[i]).emoji}</span>
                    <span className="day-rain">
                      💧 {daily.precipitation_probability_max[i] ?? 0}%
                    </span>
                    <div className="day-temps">
                      <span className="day-max">{Math.round(daily.temperature_2m_max[i])}°</span>
                      <span className="day-min">{Math.round(daily.temperature_2m_min[i])}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        )}

      </div>
    </div>
  )
}
