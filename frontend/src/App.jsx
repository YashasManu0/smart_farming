import { useState, useRef } from "react";
import WeatherAdvisory from "./components/WeatherAdvisory";
import LanguageSelector from "./components/LanguageSelector";
import MandiPrices from "./components/MandiPrices";
import KanbanBoard from "./components/KanbanBoard";

const NAV_TABS = [
  { id: "diagnosis", label: "🌿 Crop Diagnosis" },
  { id: "weather", label: "⛅ Weather & Advisories" },
  { id: "mandi", label: "🌾 Mandi Prices" },
  { id: "kanban", label: "📋 Farm Kanban" },
];

const REMEDY_TYPES = [
  { key: "organic", icon: "🌿", title: "Organic Solutions", cls: "organic" },
  { key: "chemical", icon: "🧪", title: "Chemical Fungicide Treatments", cls: "chemical" },
  { key: "prevention", icon: "🛡️", title: "Cultural & Prevention Practices", cls: "prevention" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("diagnosis");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [engine, setEngine] = useState("deep");
  const [resultTab, setResultTab] = useState("diagnosis");
  const [remediesLoading, setRemediesLoading] = useState(false);

  const fileInputRef = useRef(null);

  const handleSelectImage = (file) => {
    if (file?.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setResultTab("diagnosis");
    }
  };

  const handleDiagnose = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("engine", engine);

    try {
      const res = await fetch("/predict", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Diagnosis failed. Check backend connection.");
      setResult(await res.json());
      setResultTab("diagnosis");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchRemedies = async () => {
    if (!result) return;
    setRemediesLoading(true);
    try {
      const res = await fetch("/api/remedies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant: result.plant, condition: result.condition }),
      });
      const data = await res.json();
      if (data.remedies) setResult((prev) => ({ ...prev, remedies: data.remedies }));
    } catch (e) {
      alert("Could not load remedies: " + e.message);
    } finally {
      setRemediesLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setResultTab("diagnosis");
  };

  const remedies = result?.remedies ? (typeof result.remedies === "object" ? result.remedies : { organic: result.remedies }) : null;

  return (
    <div className="app-container">
      <LanguageSelector />
      <header className="header">
        <h1 className="title">🌿 Plant Disease Detector</h1>
        <p className="subtitle">AI-Powered Disease Diagnosis & Treatment Remedies</p>

        <div className="nav-tabs-wrapper">
          <div className="nav-tabs">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "diagnosis" && (
          <div className="switch-wrapper">
            <div className="segmented-control">
              <button type="button" className={`segment-btn ${engine === "deep" ? "active" : ""}`} onClick={() => { setEngine("deep"); setResult(null); }}>
                🔬 Deep Diagnostic Mode
              </button>
              <button type="button" className={`segment-btn ${engine === "fast" ? "active" : ""}`} onClick={() => { setEngine("fast"); setResult(null); }}>
                ⚡ Fast Scan Mode
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="card">
        {activeTab === "weather" && <WeatherAdvisory />}
        {activeTab === "mandi" && <MandiPrices />}
        {activeTab === "kanban" && <KanbanBoard />}
        {activeTab === "diagnosis" && (
          <>
            <div
              className={`dropzone ${previewUrl ? "has-preview" : ""}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleSelectImage(e.dataTransfer.files[0]); }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden-input" onChange={(e) => handleSelectImage(e.target.files[0])} />
              {previewUrl ? (
                <div className="preview-box">
                  <img src={previewUrl} alt="Preview" className="preview-img" />
                  <p className="change-text">Click or drag another image to replace</p>
                </div>
              ) : (
                <div className="placeholder">
                  <span className="leaf-icon">🍃</span>
                  <p className="upload-prompt">Click to browse or drop plant photo here</p>
                  <span className="upload-note">Supports JPG, PNG, WEBP (Leaves, Fruits, Orchards)</span>
                </div>
              )}
            </div>

            {selectedFile && !result && (
              <button className="action-btn" onClick={handleDiagnose} disabled={loading}>
                {loading ? "Analyzing Leaf Image..." : "Run Plant Diagnosis"}
              </button>
            )}

            {error && <div className="error-box">{error}</div>}

            {result && (
              <div className="results-container">
                <div className="model-badge-row">
                  <span className="model-badge">⚙️ {result.model_used || "Detector"}</span>
                </div>
                {result.warning && <div className="warning-banner">⚠️ {result.warning}</div>}

                <div className="result-tab-bar">
                  <button type="button" className={`result-tab-btn ${resultTab === "diagnosis" ? "active" : ""}`} onClick={() => setResultTab("diagnosis")}>
                    📋 Disease Diagnosis
                  </button>
                  <button
                    type="button"
                    className={`result-tab-btn ${resultTab === "remedies" ? "active" : ""}`}
                    onClick={() => {
                      setResultTab("remedies");
                      if (!result.remedies && !result.is_healthy) handleFetchRemedies();
                    }}
                  >
                    💊 Solution & Remedies
                  </button>
                </div>

                {resultTab === "diagnosis" && (
                  <div className="tab-content">
                    <div className="result-header">
                      <div>
                        <span className="label">Detected Plant</span>
                        <h2 className="plant-name">{result.plant}</h2>
                      </div>
                      <span className={`status-tag ${result.is_healthy ? "healthy" : "diseased"}`}>
                        {result.is_healthy ? "✓ Healthy" : "⚠ Disease Detected"}
                      </span>
                    </div>

                    <div className="condition-box">
                      <span className="label">Condition</span>
                      <h3 className="condition-name">{result.condition}</h3>
                      <div className="confidence-wrapper">
                        <div className="confidence-row">
                          <span>Confidence</span>
                          <span className="confidence-value">{result.confidence}%</span>
                        </div>
                        <div className="bar-track">
                          <div className={`bar-fill ${result.confidence < 60 ? "low" : "high"}`} style={{ width: `${Math.min(result.confidence, 100)}%` }} />
                        </div>
                      </div>
                    </div>

                    {result.affected_area && (
                      <div className="affected-area-box">
                        <span className="label">📍 Affected Foliage Area</span>
                        <p className="affected-area-text">{result.affected_area}</p>
                      </div>
                    )}

                    {result.explanation && (
                      <div className="detail-card explanation-card">
                        <p className="detail-title">🔍 Visual Observations:</p>
                        <p className="detail-text">{result.explanation}</p>
                      </div>
                    )}

                    {result.regenerated_image && (
                      <div className="regenerated-image-card">
                        <div className="regenerated-image-header">
                          <span className="regenerated-badge">🎯 Visual Pathology Map</span>
                          <span className="regenerated-sub">Affected area outlined & named</span>
                        </div>
                        <div className="regenerated-img-wrapper">
                          <img src={result.regenerated_image} alt="Regenerated Leaf Diagnosis" className="regenerated-img" />
                        </div>
                      </div>
                    )}

                    {result.top3?.length > 0 && (
                      <div className="candidates-list">
                        <p className="candidates-title">Alternative Diagnoses:</p>
                        {result.top3.map((item, idx) => (
                          <div key={idx} className="candidate-item">
                            <span>{idx + 1}. {item.name}</span>
                            <strong>{item.prob}%</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {resultTab === "remedies" && (
                  <div className="tab-content">
                    <div className="remedies-header">
                      <h3 className="remedies-title">Treatment Plan for {result.condition}</h3>
                      <p className="remedies-subtitle">Targeted management solutions for {result.plant}</p>
                    </div>

                    {result.is_healthy ? (
                      <div className="detail-card healthy-card">
                        <p className="detail-title">🌱 Good News!</p>
                        <p className="detail-text">This plant appears healthy. Maintain standard cultural practices: water at the base, ensure sunlight, and add organic compost.</p>
                      </div>
                    ) : remediesLoading ? (
                      <div className="loading-box">⏳ Formulating treatment recommendations...</div>
                    ) : remedies ? (
                      <div className="remedies-list">
                        {REMEDY_TYPES.map((type) => remedies[type.key] && (
                          <div key={type.key} className={`remedy-block ${type.cls}-block`}>
                            <div className="remedy-block-header">
                              <span className={`remedy-badge ${type.cls}-badge`}>{type.icon} {type.title}</span>
                            </div>
                            <p className="remedy-body">{remedies[type.key]}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="detail-card">
                        <p className="detail-text">Detailed treatment recommendations not yet generated for this scan.</p>
                        <button type="button" className="action-btn" style={{ marginTop: "12px", padding: "8px" }} onClick={handleFetchRemedies}>
                          ✨ Generate Treatment Plan
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button className="reset-btn" onClick={handleReset}>Test Another Leaf</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
