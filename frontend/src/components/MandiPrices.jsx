import { useState, useEffect, useRef } from "react";

const INDIAN_STATES = [
  "All States",
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
];

const POPULAR_CROPS = [
  "All",
  "Tomato",
  "Potato",
  "Onion",
  "Wheat",
  "Rice",
  "Cotton",
  "Soybean",
  "Mustard",
  "Maize"
];

export default function MandiPrices() {
  const [selectedState, setSelectedState] = useState("All States");
  const [commodity, setCommodity] = useState("");
  const [debouncedCommodity, setDebouncedCommodity] = useState("");
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [metaInfo, setMetaInfo] = useState(null);
  const [error, setError] = useState(null);

  const debounceTimerRef = useRef(null);

  // 1. Geolocation State Auto-Detection on initial mount
  useEffect(() => {
    handleDetectState();
  }, []);

  const handleDetectState = () => {
    if (!navigator.geolocation) return;

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const detected = data.principalSubdivision;
            if (detected) {
              const matched = INDIAN_STATES.find(
                (s) => s.toLowerCase() === detected.toLowerCase()
              );
              if (matched) {
                setSelectedState(matched);
                setPage(1);
              }
            }
          }
        } catch {
          // Geolocation reverse geocoding fallback
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setDetectingLocation(false);
      },
      { timeout: 8000 }
    );
  };

  // 2. Debounce commodity search input (350ms)
  const handleCommodityChange = (e) => {
    const val = e.target.value;
    setCommodity(val);
    setPage(1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedCommodity(val.trim());
    }, 350);
  };

  // Quick crop button click
  const handleQuickCrop = (crop) => {
    const val = crop === "All" ? "" : crop;
    setCommodity(val);
    setDebouncedCommodity(val);
    setPage(1);
  };

  // 3. Fetch Mandi rates from backend (/api/mandi)
  useEffect(() => {
    let isMounted = true;
    const fetchMandi = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedState && selectedState !== "All States") {
        params.append("state", selectedState);
      }
      if (debouncedCommodity) {
        params.append("commodity", debouncedCommodity);
      }
      params.append("page", page.toString());
      params.append("limit", "12");

      try {
        const response = await fetch(`/api/mandi?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to load Mandi rates");
        const data = await response.json();

        if (isMounted) {
          setRecords(data.records || []);
          setTotal(data.total || 0);
          setMetaInfo({
            source: data.source || "Agmarknet",
            cached: data.cached || false,
            cacheAge: data.cache_age_seconds || 0,
            aliasUsed: data.alias_used || null,
            canonicalCommodity: data.canonical_commodity || null
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to retrieve wholesale mandi data");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMandi();
    return () => {
      isMounted = false;
    };
  }, [selectedState, debouncedCommodity, page]);

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="mandi-container">
      {/* Header info */}
      <div className="mandi-header">
        <div>
          <h2 className="mandi-title">🌾 Mandi Wholesale Market Rates</h2>
          <p className="mandi-subtitle">
            Real-time daily arrivals and modal prices from APMC markets across India (Agmarknet)
          </p>
        </div>
        <button
          type="button"
          className="geo-detect-btn"
          onClick={handleDetectState}
          disabled={detectingLocation}
          title="Auto-detect Indian State from your location"
        >
          {detectingLocation ? "📍 Locating..." : "📍 Auto-Detect State"}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mandi-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">State / UT</label>
            <select
              className="state-select"
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setPage(1);
              }}
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group flex-1">
            <label className="filter-label">Search Crop / Commodity</label>
            <div className="search-input-wrap">
              <input
                type="text"
                className="crop-input"
                placeholder="Type crop name (e.g. Tomato, Wheat, Onion)..."
                value={commodity}
                onChange={handleCommodityChange}
              />
              {commodity && (
                <button
                  type="button"
                  className="clear-input-btn"
                  onClick={() => handleQuickCrop("All")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Crop Pills */}
        <div className="quick-crops">
          <span className="quick-crops-label">Popular:</span>
          {POPULAR_CROPS.map((crop) => {
            const isActive =
              (crop === "All" && !debouncedCommodity) ||
              debouncedCommodity.toLowerCase() === crop.toLowerCase();
            return (
              <button
                key={crop}
                type="button"
                className={`crop-pill ${isActive ? "active" : ""}`}
                onClick={() => handleQuickCrop(crop)}
              >
                {crop}
              </button>
            );
          })}
        </div>
      </div>

      {/* Commodity Alias Indicator */}
      {metaInfo?.aliasUsed && (
        <div className="alias-banner">
          💡 Showing Agmarknet results for <strong>{metaInfo.canonicalCommodity}</strong> (matched &ldquo;{commodity}&rdquo;)
        </div>
      )}

      {/* Meta badge: Source & Cache Status */}
      {metaInfo && (
        <div className="mandi-status-bar">
          <div className="status-badges">
            <span className="source-tag">📡 {metaInfo.source}</span>
            <span className="cache-tag">
              ⚡ 15m Cache {metaInfo.cached ? `(Hit: ${metaInfo.cacheAge}s ago)` : "(Refreshed)"}
            </span>
          </div>
          <span className="count-tag">
            {total} {total === 1 ? "arrival reported" : "arrivals reported"}
          </span>
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div className="mandi-loading">
          <div className="loading-spinner"></div>
          <p>Fetching latest APMC market prices...</p>
        </div>
      )}

      {error && !loading && (
        <div className="mandi-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Mandi Rate Cards Grid */}
      {!loading && !error && records.length > 0 && (
        <div className="mandi-grid">
          {records.map((r, idx) => {
            const modalPerKg = (r.modal_price / 100).toFixed(1);
            return (
              <div key={`${r.market}-${r.commodity}-${idx}`} className="mandi-card">
                <div className="card-top">
                  <div className="commodity-info">
                    <span className="commodity-name">{r.commodity}</span>
                    <span className="variety-badge">{r.variety || "Standard"}</span>
                  </div>
                  <span className="arrival-date">📅 {r.arrival_date}</span>
                </div>

                <div className="card-location">
                  <span className="market-name">🏛️ {r.market}</span>
                  <span className="district-state">
                    📍 {r.district ? `${r.district}, ` : ""}{r.state}
                  </span>
                </div>

                <div className="price-box">
                  <div className="modal-price-col">
                    <span className="price-label">Modal Market Price</span>
                    <span className="modal-price-val">₹{r.modal_price.toLocaleString("en-IN")}</span>
                    <span className="per-quintal">per quintal (₹{modalPerKg}/kg)</span>
                  </div>
                </div>

                <div className="price-range">
                  <div className="range-item">
                    <span className="range-lbl">Min Price</span>
                    <span className="range-val">₹{r.min_price.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="range-bar-wrapper">
                    <div className="range-bar-fill"></div>
                  </div>
                  <div className="range-item text-right">
                    <span className="range-lbl">Max Price</span>
                    <span className="range-val">₹{r.max_price.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && records.length === 0 && (
        <div className="mandi-empty">
          <span className="empty-icon">🌾</span>
          <h3>No Market Arrivals Found</h3>
          <p>
            No active mandi prices found for &ldquo;{debouncedCommodity || "this crop"}&rdquo; in{" "}
            <strong>{selectedState}</strong>. Try selecting &ldquo;All States&rdquo; or a suggested crop below:
          </p>
          <div className="empty-suggestions">
            {["Maize", "Tomato", "Potato", "Onion", "Wheat", "Rice", "Cotton"].map((c) => (
              <button
                key={c}
                type="button"
                className="crop-pill"
                onClick={() => handleQuickCrop(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="reset-filter-btn"
            onClick={() => {
              setSelectedState("All States");
              handleQuickCrop("All");
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && totalPages > 1 && (
        <div className="mandi-pagination">
          <button
            type="button"
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span className="page-indicator">
            Page <strong>{page}</strong> of {totalPages}
          </span>
          <button
            type="button"
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
