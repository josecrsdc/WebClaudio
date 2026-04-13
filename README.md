# WeatherBoard

Aplicación web en React + Vite para consultar el tiempo, calidad del aire y previsiones con datos en tiempo real de Open‑Meteo y geocodificación de Nominatim (OpenStreetMap). Incluye un minijuego y vista de ubicaciones cercanas.

## Características
- Búsqueda de ciudades con sugerencias y selección rápida de recientes/favoritos (persisten en `localStorage`).
- Panel principal: estado actual, sensación térmica, humedad, viento con dirección, índice UV, amanecer/atardecer.
- Calidad del aire (US AQI) con barra de intensidad.
- Próximas 24h (lista expandible) y gráfico de temperatura/lluvia (Recharts).
- Previsión 7 días con iconos WMO.
- Mapa interactivo (Leaflet) centrado en la ubicación buscada.
- “Tiempo en los alrededores”: calcula 8 puntos a ~80 km y permite abrir uno como nueva ubicación con filtros por condición.
- Minijuego “¿Cuál hace más calor?”: 10 rondas comparando ciudades reales con datos en vivo.
- Caché en memoria para meteo/AQI y control básico de errores y timeouts.

## Requisitos
- Node.js 18+ (probado con 20.11.0).

## Puesta en marcha
```bash
npm install
npm run dev
```
Abre http://localhost:5173

## Scripts disponibles
- `npm run dev` – servidor de desarrollo con HMR.
- `npm run build` – build de producción.
- `npm run preview` – sirve la build localmente.
- `npm run lint` – ESLint.

## Fuentes de datos
- Meteo y AQI: [Open‑Meteo](https://open-meteo.com)
- Geocodificación: [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org)

## Notas de diseño
- Interfaz en español, paleta adaptada según condición (despejado/nublado/lluvia/nieve/tormenta).
- Íconos de clima de Lucide, mapa Leaflet con fijación de assets para Vite.
