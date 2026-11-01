/**
 * Agricultural decision rules and weather utilities for farmers.
 */

// WMO Weather Interpretation Codes (Open-Meteo standard)
export function getWmoWeather(code) {
  if (code === 0) return { label: "Clear Sky", icon: "☀️" };
  if (code === 1 || code === 2) return { label: "Partly Cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code >= 45 && code <= 48) return { label: "Foggy", icon: "🌫️" };
  if (code >= 51 && code <= 55) return { label: "Light Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 65) return { label: "Rainy", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Rain Showers", icon: "🌧️" };
  if (code >= 95) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "Cloudy", icon: "⛅" };
}

/**
 * Computes simple, actionable farmer advisories from weather metrics.
 */
export function computeFarmerAdvisories({ windSpeed, rainProb, soilTemp, humidity, temp }) {
  const advisories = [];

  // 1. Wind & Spraying Advisory
  if (windSpeed > 20) {
    advisories.push({
      category: "Spraying Decision",
      status: "halt",
      title: "🛑 Halt Spraying Operations",
      message: `Wind speed is ${windSpeed} km/h. High winds will cause severe spray drift into non-target areas and rapid chemical evaporation.`,
    });
  } else if (windSpeed >= 12) {
    advisories.push({
      category: "Spraying Decision",
      status: "caution",
      title: "⚠️ Caution on Spraying",
      message: `Wind is ${windSpeed} km/h. Moderate breeze present. Use coarse spray droplets and lower boom height to reduce drift.`,
    });
  } else if (windSpeed < 3) {
    advisories.push({
      category: "Spraying Decision",
      status: "caution",
      title: "⚠️ Temperature Inversion Risk",
      message: `Dead calm air (${windSpeed} km/h). Check for inversion layers where fine mist can suspend and drift unpredictably.`,
    });
  } else {
    advisories.push({
      category: "Spraying Decision",
      status: "safe",
      title: " Ideal Spraying Window",
      message: `Wind is gentle (${windSpeed} km/h). Optimal conditions for foliar application and uniform crop coverage.`,
    });
  }

  // 2. Rain Washout Advisory
  if (rainProb >= 60) {
    advisories.push({
      category: "Chemical Adherence",
      status: "halt",
      title: "🛑 Postpone Chemical Treatments",
      message: `High rain probability (${rainProb}%). Rain within the next few hours will wash off contact fungicides and pesticides before absorption.`,
    });
  } else if (rainProb >= 30) {
    advisories.push({
      category: "Chemical Adherence",
      status: "caution",
      title: "⚠️ Moderate Washout Risk",
      message: `${rainProb}% chance of rain. If spraying is critical, use rain-fast systemic formulations with a spreading adjuvant.`,
    });
  } else {
    advisories.push({
      category: "Chemical Adherence",
      status: "safe",
      title: " Dry Window Ahead",
      message: `Low rain probability (${rainProb}%). Excellent dry window for treatment absorption and field work.`,
    });
  }

  // 3. Soil Temperature & Planting Advisory
  if (soilTemp !== undefined && soilTemp !== null) {
    if (soilTemp < 10) {
      advisories.push({
        category: "Soil & Sowing",
        status: "halt",
        title: "❄️ Soil Too Cold for Sowing",
        message: `Topsoil is ${soilTemp}°C (< 10°C). Sowing warm-season crops (tomatoes, peppers, corn) now risks seed rot and poor germination.`,
      });
    } else if (soilTemp >= 10 && soilTemp < 18) {
      advisories.push({
        category: "Soil & Sowing",
        status: "caution",
        title: "🌾 Cool-Season Planting Active",
        message: `Topsoil is ${soilTemp}°C. Favorable for cool-season crops (wheat, peas, brassicas), but warm crops require row protection.`,
      });
    } else if (soilTemp > 35) {
      advisories.push({
        category: "Soil & Sowing",
        status: "caution",
        title: "🔥 High Soil Heat Stress",
        message: `Surface soil reached ${soilTemp}°C. High heat stresses shallow root systems. Apply straw or organic mulch to retain moisture.`,
      });
    } else {
      advisories.push({
        category: "Soil & Sowing",
        status: "safe",
        title: "🌱 Optimal Soil Conditions",
        message: `Topsoil temperature is ${soilTemp}°C. Ideal for rapid seed germination and healthy root system development.`,
      });
    }
  }

  // 4. Fungal Disease Outbreak Pressure
  if (humidity >= 80 && temp >= 18 && temp <= 28) {
    advisories.push({
      category: "Disease Pressure",
      status: "caution",
      title: "🍄 High Fungal Outbreak Risk",
      message: `Warm temperature (${temp}°C) combined with high humidity (${humidity}%) creates ideal conditions for fungal spore germination and blight spread.`,
    });
  }

  return advisories;
}
