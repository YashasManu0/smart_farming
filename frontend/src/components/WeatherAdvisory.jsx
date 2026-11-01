import { useState, useEffect } from "react";
import { getWmoWeather, computeFarmerAdvisories } from "../utils/weatherRules";

export default function WeatherAdvisory() {
  const [query, setQuery] = useState("");
  const [locationName, setLocationName] = useState(
    () => localStorage.getItem("last_farm_location") || "Central Valley Farm"
  );
  const [coords, setCoords] = useState(() => {
    const saved = localStorage.getItem("last_farm_coords");
    return saved ? JSON.parse(saved) : { lat: 36.7468, lon: -119.7726 }; // Default agricultural hub
  });

  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchingCity, setSearchingCity] = useState(false);

  // Fetch forecast whenever coordinates change
  useEffect(() => {
    fetchForecast(coords.lat, coords.lon);
  }, [coords]);

  // Fetch Open-Meteo forecast
  const fetchForecast = async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,soil_temperature_0cm&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=3`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load weather data.");
      const data = await res.json();
      setWeather(data);
    } catch (err) {
      setError(err.message || "Failed to load weather forecast.");
    } finally {
      setLoading(false);
    }
  };

  // Browser Geolocation
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
        };
        const name = "Current Farm Location";
        setLocationName(name);
        setCoords(newCoords);
        localStorage.setItem("last_farm_location", name);
        localStorage.setItem("last_farm_coords", JSON.stringify(newCoords));
      },
      (err) => {
        setLoading(false);
        alert("Location access denied or unavailable: " + err.message);
      }
    );
  };

  // Search City via Open-Meteo Geocoding API
  const handleSearchCity = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearchingCity(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query.trim()
        )}&count=4&language=en&format=json`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
      } else {
        alert("No locations found for '" + query + "'.");
        setSearchResults([]);
      }
    } catch {
      alert("Error searching for location.");
    } finally {
      setSearchingCity(false);
    }
  };

  const handleSelectCity = (city) => {
    const name = `${city.name}, ${city.admin1 || city.country || ""}`.trim();
    const newCoords = { lat: city.latitude, lon: city.longitude };
    setLocationName(name);
    setCoords(newCoords);
    setSearchResults([]);
    setQuery("");
    localStorage.setItem("last_farm_location", name);
    localStorage.setItem("last_farm_coords", JSON.stringify(newCoords));
  };

  // Derive advisories from current data
  const current = weather?.current;
  const currentRainProb =
    weather?.hourly?.precipitation_probability?.[0] ?? 0;
  const condition = current ? getWmoWeather(current.weather_code) : null;

  const advisories = current
    ? computeFarmerAdvisories({
        windSpeed: current.wind_speed_10m,
        rainProb: currentRainProb,
        soilTemp: current.soil_temperature_0cm,
        humidity: current.relative_humidity_2m,
        temp: current.temperature_2m,
      })
    : [];

  // Next 12 hours slice
  const nextHours = weather?.hourly?.time
    ? weather.hourly.time.slice(0, 12).map((timeStr, idx) => ({
        time: timeStr.split("T")[1].slice(0, 5),
        temp: weather.hourly.temperature_2m[idx],
        rain: weather.hourly.precipitation_probability[idx],
        wind: weather.hourly.wind_speed_10m[idx],
        weather: getWmoWeather(weather.hourly.weather_code[idx]),
      }))
    : [];

  return (
    <div className="weather-section">
      {/* Location Search Bar */}
      <div className="location-bar">
        <form onSubmit={handleSearchCity} className="search-form">
          <input
            type="text"
            className="search-input"
            placeholder="Search farm city or district..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="search-btn" disabled={searchingCity}>
            {searchingCity ? "Searching..." : "🔍 Search"}
          </button>
        </form>
        <button
          type="button"
          className="location-btn"
          onClick={handleUseMyLocation}
          title="Detect GPS location"
        >
          📍 GPS
        </button>
      </div>

      {/* City search results dropdown */}
      {searchResults.length > 0 && (
        <div className="search-dropdown">
          <p className="dropdown-title">Select your agricultural area:</p>
          {searchResults.map((city) => (
            <button
              key={city.id}
              type="button"
              className="dropdown-item"
              onClick={() => handleSelectCity(city)}
            >
              <strong>{city.name}</strong>, {city.admin1 ? `${city.admin1}, ` : ""}
              {city.country}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="weather-loading">⏳ Updating field weather...</div>}
      {error && <div className="error-box">{error}</div>}

      {/* Weather Content */}
      {weather && current && !loading && (
        <div className="weather-content">
          {/* Header Card */}
          <div className="weather-header-card">
            <div>
              <span className="location-tag">📍 Field Location</span>
              <h2 className="location-title">{locationName}</h2>
              <p className="condition-subtitle">
                {condition.icon} {condition.label} • Updated Just Now
              </p>
            </div>
            <div className="current-temp-box">
              <span className="current-temp">{Math.round(current.temperature_2m)}°C</span>
              <span className="feels-like">Feels {Math.round(current.apparent_temperature)}°C</span>
            </div>
          </div>

          {/* Metric Grid */}
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">🌬️ Wind Speed</span>
              <p className="metric-val">{current.wind_speed_10m} km/h</p>
              <span className="metric-note">Target: &lt; 15 km/h</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">🌧️ Rain Probability</span>
              <p className="metric-val">{currentRainProb}%</p>
              <span className="metric-note">Next 6 Hours</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">🌱 Soil Temp (0cm)</span>
              <p className="metric-val">
                {current.soil_temperature_0cm !== undefined
                  ? `${current.soil_temperature_0cm}°C`
                  : "N/A"}
              </p>
              <span className="metric-note">Ideal: 18–28°C</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">💧 Humidity</span>
              <p className="metric-val">{current.relative_humidity_2m}%</p>
              <span className="metric-note">Dew Point Risk</span>
            </div>
          </div>

          {/* FARMER ADVISORIES */}
          <div className="advisories-section">
            <h3 className="section-heading">🚜 Real-Time Field Advisories</h3>
            <div className="advisories-list">
              {advisories.map((item, idx) => (
                <div key={idx} className={`advisory-item ${item.status}`}>
                  <div className="advisory-top">
                    <span className="advisory-title">{item.title}</span>
                    <span className={`advisory-pill ${item.status}`}>
                      {item.category}
                    </span>
                  </div>
                  <p className="advisory-desc">{item.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* HOURLY SPRAYING & WEATHER TIMELINE (Next 12 Hours) */}
          <div className="hourly-section">
            <h3 className="section-heading">⏱️ Hourly Field Conditions (Next 12 Hours)</h3>
            <div className="hourly-strip">
              {nextHours.map((h, i) => (
                <div key={i} className="hourly-card">
                  <span className="hourly-time">{h.time}</span>
                  <span className="hourly-icon">{h.weather.icon}</span>
                  <span className="hourly-temp">{Math.round(h.temp)}°C</span>
                  <span className="hourly-rain">🌧️ {h.rain}%</span>
                  <span className="hourly-wind">🌬️ {Math.round(h.wind)}km/h</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3-DAY OUTLOOK */}
          {weather.daily && (
            <div className="daily-section">
              <h3 className="section-heading">📅 3-Day Agricultural Outlook</h3>
              <div className="daily-list">
                {weather.daily.time.map((dateStr, i) => {
                  const dayName =
                    i === 0
                      ? "Today"
                      : new Date(dateStr + "T00:00:00").toLocaleDateString(
                          undefined,
                          { weekday: "short", month: "short", day: "numeric" }
                        );
                  const w = getWmoWeather(weather.daily.weather_code[i]);
                  return (
                    <div key={i} className="daily-row">
                      <span className="daily-day">{dayName}</span>
                      <span className="daily-icon-label">
                        {w.icon} {w.label}
                      </span>
                      <span className="daily-rain">
                        🌧️ {weather.daily.precipitation_probability_max[i]}%
                      </span>
                      <span className="daily-temp">
                        {Math.round(weather.daily.temperature_2m_max[i])}° /{" "}
                        {Math.round(weather.daily.temperature_2m_min[i])}°C
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
