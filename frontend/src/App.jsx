import { useState, useRef } from "react";
import "./App.css";
import History from "./History";

const API_URL = "http://localhost:8000/predict";

const DISEASE_INFO = {
  "Melanoma": {
    name: "Melanoma",
    severity: "high",
    icon: "\u26a0\ufe0f",
    description: "Melanoma is the most serious type of skin cancer. It starts in the cells that give your skin its color (melanocytes) and can spread to other parts of the body if not caught early.",
    steps: [
      "Do not try to treat this at home. Seek a dermatologist urgently.",
      "Avoid sun exposure on the area and do not pick or scratch the lesion.",
      "Take photos to track any changes until your appointment.",
    ],
  },
  "Melanocytic nevi": {
    name: "Mole (Melanocytic Nevi)",
    severity: "low",
    icon: "\u2705",
    description: "A mole is a very common, usually harmless growth on the skin made up of pigment-producing cells. Most people have between 10\u201340 moles by adulthood.",
    steps: [
      "No treatment is usually needed.",
      "Monitor it monthly using the ABCDE rule: Asymmetry, Border irregularity, Color variation, Diameter >6mm, Evolution (change over time).",
      "Use SPF 30+ sunscreen on exposed skin to protect moles from UV damage.",
    ],
  },
  "Benign keratosis-like lesions": {
    name: "Seborrheic Keratosis / Solar Lentigo",
    severity: "low",
    icon: "\u2705",
    description: "These are harmless, non-cancerous growths that often appear as waxy, \u201cstuck-on\u201d patches or flat brown spots. They become more common with age and are caused by a buildup of skin cells.",
    steps: [
      "No treatment is needed unless the lesion is irritated or cosmetically bothersome.",
      "Avoid scratching or picking at it, as this can cause irritation or infection.",
      "Moisturizing the area can reduce itchiness.",
      "Over-the-counter products containing alpha-hydroxy acids (AHAs) may gently lighten flat spots over time.",
    ],
  },
  "Basal cell carcinoma": {
    name: "Basal Cell Carcinoma",
    severity: "high",
    icon: "\u26a0\ufe0f",
    description: "Basal cell carcinoma is the most common type of skin cancer, but also the least dangerous when caught early. It grows slowly and rarely spreads. It often looks like a shiny bump, a pink patch, or a sore that won\u2019t heal.",
    steps: [
      "Do not attempt to treat this at home \u2014 a dermatologist visit is necessary.",
      "Avoid sun exposure on the area and apply broad-spectrum SPF 50+ sunscreen daily.",
      "Keep a log of any changes in size or appearance before your appointment.",
    ],
  },
  "Actinic keratoses": {
    name: "Actinic Keratoses (Pre-cancerous)",
    severity: "medium",
    icon: "\u26a0\ufe0f",
    description: "Actinic keratoses are rough, scaly patches caused by years of sun exposure. They are considered pre-cancerous \u2014 if left untreated, a small percentage can develop into squamous cell carcinoma.",
    steps: [
      "See a dermatologist \u2014 treatment is typically quick (e.g., cryotherapy or prescription creams).",
      "Apply SPF 30+ sunscreen every day and wear protective clothing outdoors.",
      "Avoid picking or scratching the rough patches.",
    ],
  },
  "Vascular lesions": {
    name: "Vascular Lesions (Blood Vessel Growths)",
    severity: "low",
    icon: "\u2705",
    description: "Vascular lesions are growths made up of blood vessels near the surface of the skin. They include cherry angiomas, spider veins, and pyogenic granulomas. Most are harmless, though some can bleed easily.",
    steps: [
      "Most do not require treatment.",
      "Avoid trauma to the area \u2014 if it bleeds, apply gentle pressure with a clean cloth.",
      "Do not attempt to remove or squeeze vascular lesions at home.",
      "If a pyogenic granuloma is suspected (bleeds frequently), see a doctor for removal.",
    ],
  },
  "Dermatofibroma": {
    name: "Dermatofibroma",
    severity: "low",
    icon: "\u2705",
    description: "A dermatofibroma is a small, firm, benign (non-cancerous) bump that most commonly appears on the legs. It\u2019s thought to be a harmless reaction of the skin to a minor injury, insect bite, or ingrown hair.",
    steps: [
      "No treatment is needed in most cases.",
      "If it becomes irritated by shaving or clothing, apply a gentle moisturizer.",
      "Avoid trying to cut, scrape, or remove it at home.",
      "See a doctor if it grows rapidly, changes color, or becomes painful.",
    ],
  },
};

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("upload"); // "upload" | "camera"
  const [cameraActive, setCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [activeTab, setActiveTab] = useState("analyze");
  const [toast, setToast] = useState(null);
  const [genImages, setGenImages] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const fileRef = useRef();
  const dropRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleFile(file) {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    dropRef.current.classList.remove("dragover");
    handleFile(e.dataTransfer.files[0]);
  }

  function reset() {
    stopCamera();
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setMode("upload");
    setGenImages(null);
  }

  // ---- Camera ----
  async function loadCameras() {
    try {
      // Need a temporary stream to trigger permission prompt, then enumerate
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }

  async function startCamera(deviceId) {
    setError(null);
    const camId = deviceId || selectedCamera;
    try {
      // Load camera list if not loaded yet
      if (cameras.length === 0) {
        await loadCameras();
      }
      const constraints = camId
        ? { video: { deviceId: { exact: camId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setImage(file);
      setPreview(canvas.toDataURL("image/jpeg"));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function switchMode(newMode) {
    if (newMode === mode) return;
    stopCamera();
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setMode(newMode);
  }

  async function analyze() {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", image);
      const res = await fetch(API_URL, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || "Server error");
      const data = await res.json();
      setResult(data);
      // Show annotated image with bounding boxes if available
      if (data.annotated_image) {
        setPreview(`data:image/png;base64,${data.annotated_image}`);
      }
      showToast("Saved to history");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateImages(diagnosisId) {
    setGenLoading(true);
    try {
      const res = await fetch("http://localhost:8000/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis_id: diagnosisId }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Image generation failed");
      setGenImages(await res.json());
    } catch (e) {
      setGenImages({ error: e.message });
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <div className="layout">
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="nav-logo">S</div>
          <span className="nav-title">SkinScreener</span>
        </div>
        <div className="nav-links">
          <span
            className={`nav-link ${activeTab === "analyze" ? "active" : ""}`}
            onClick={() => setActiveTab("analyze")}
          >
            Analyze
          </span>
          <span
            className={`nav-link ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </span>
          <span className="nav-link">About</span>
        </div>
        <div className="nav-right">
          <div className="nav-icon">?</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main">
        {activeTab === "history" ? (
          <>
            <div className="page-header">
              <div>
                <h1>Diagnosis History</h1>
                <p className="page-subtitle">Review your past skin analyses and track changes over time</p>
              </div>
            </div>
            <History />
          </>
        ) : (
          <>
            {/* Header */}
            <div className="page-header">
              <div>
                <h1>Skin Lesion Analysis</h1>
                <p className="page-subtitle">Upload or capture a skin image for AI-powered diagnostic insights</p>
              </div>
              {(image || cameraActive) && (
                <button className="btn-outline" onClick={reset}>New Analysis</button>
              )}
            </div>

            {/* Disclaimer */}
            <div className="disclaimer">
              <span className="disclaimer-icon">&#9432;</span>
              This tool is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.
            </div>

            {/* Dashboard Grid */}
            <div className={`dashboard ${result ? "has-results" : ""}`}>
              {/* Input Card */}
              <div className="card upload-card">
                {/* Mode Toggle */}
                <div className="card-header">
                  <div className="mode-toggle">
                    <button
                      className={`mode-btn ${mode === "upload" ? "active" : ""}`}
                      onClick={() => switchMode("upload")}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
                      </svg>
                      Upload
                    </button>
                    <button
                      className={`mode-btn ${mode === "camera" ? "active" : ""}`}
                      onClick={() => switchMode("camera")}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Camera
                    </button>
                  </div>
                  <span className="card-icon">&#128247;</span>
                </div>

                {/* Upload Mode */}
                {mode === "upload" && (
                  <>
                    <div
                      className={`dropzone${preview ? " has-image" : ""}`}
                      ref={dropRef}
                      onClick={() => fileRef.current.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        dropRef.current.classList.add("dragover");
                      }}
                      onDragLeave={() => dropRef.current.classList.remove("dragover")}
                      onDrop={handleDrop}
                    >
                      {preview ? (
                        <img src={preview} alt="Preview" />
                      ) : (
                        <div className="dropzone-content">
                          <div className="upload-icon">
                            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
                            </svg>
                          </div>
                          <p className="drop-main">Drag & drop your image here</p>
                          <p className="drop-sub">or click to browse files</p>
                          <span className="drop-formats">JPG, PNG, WEBP supported</span>
                        </div>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleFile(e.target.files[0])}
                      />
                    </div>
                  </>
                )}

                {/* Camera Mode */}
                {mode === "camera" && (
                  <div className="camera-area">
                    {/* Camera selector */}
                    {cameras.length > 1 && (
                      <select
                        className="camera-select"
                        value={selectedCamera}
                        onChange={(e) => {
                          setSelectedCamera(e.target.value);
                          if (cameraActive) {
                            stopCamera();
                            setTimeout(() => startCamera(e.target.value), 100);
                          }
                        }}
                      >
                        {cameras.map((cam) => (
                          <option key={cam.deviceId} value={cam.deviceId}>
                            {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                    {!preview ? (
                      <>
                        <div className={`video-wrapper ${cameraActive ? "active" : ""}`}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                          />
                          {!cameraActive && (
                            <div className="camera-placeholder" onClick={() => { loadCameras().then(() => startCamera()); }}>
                              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <p>Click to start camera</p>
                              <span className="drop-formats">Point at the skin lesion, then capture</span>
                            </div>
                          )}
                        </div>
                        {cameraActive && (
                          <button className="capture-btn" onClick={captureFrame}>
                            <span className="capture-ring" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="dropzone has-image">
                        <img src={preview} alt="Captured" />
                      </div>
                    )}
                  </div>
                )}

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} hidden />

                <button
                  className="analyze-btn"
                  onClick={analyze}
                  disabled={!image || loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze Image"
                  )}
                </button>
                {error && <p className="error">{error}</p>}
              </div>

              {/* Results Section */}
              {result ? (
                <>
                  {/* Diagnosis + Explainability Card */}
                  <div className={`card prediction-card severity-${(DISEASE_INFO[result.prediction] || {}).severity || "low"}`}>
                    <div className="card-header">
                      <h3>Diagnosis</h3>
                      <span className="card-icon">&#128300;</span>
                    </div>

                    {/* Confidence ring + prediction name */}
                    <div className="prediction-top">
                      <div className="prediction-ring-wrapper">
                        <svg className="prediction-ring" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="52" fill="none" stroke="#e8ecf2" strokeWidth="10" />
                          <circle
                            cx="60" cy="60" r="52"
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${result.confidence * 327} 327`}
                            transform="rotate(-90 60 60)"
                          />
                        </svg>
                        <div className="prediction-ring-text">
                          <span className="ring-pct">{(result.confidence * 100).toFixed(0)}%</span>
                          <span className="ring-label">confidence</span>
                        </div>
                      </div>
                      <div className="prediction-top-info">
                        <div className="prediction-name">{result.prediction}</div>
                        {DISEASE_INFO[result.prediction] && (
                          <div className={`risk-badge ${DISEASE_INFO[result.prediction].severity === "high" ? "risk-high" : DISEASE_INFO[result.prediction].severity === "medium" ? "risk-medium" : "risk-low"}`}>
                            {DISEASE_INFO[result.prediction].severity === "high"
                              ? "Medical Attention Recommended"
                              : DISEASE_INFO[result.prediction].severity === "medium"
                              ? "Professional Evaluation Advised"
                              : "Generally Harmless"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <hr className="card-divider" />

                    {/* Explainability inline */}
                    {DISEASE_INFO[result.prediction] && (
                      <div className="explain-inline">
                        <h4 className="explain-name">
                          {DISEASE_INFO[result.prediction].icon} {DISEASE_INFO[result.prediction].name}
                        </h4>
                        <p className="explain-desc">{DISEASE_INFO[result.prediction].description}</p>

                        <div className="explain-steps">
                          <h4>
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            At-Home Steps
                          </h4>
                          <ul>
                            {DISEASE_INFO[result.prediction].steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Before & After Images Card */}
                  <div className="card scores-card">
                    <div className="card-header">
                      <h3>Visual Progression</h3>
                      <span className="card-icon">&#128248;</span>
                    </div>

                    {!genImages && !genLoading && (
                      <div className="gen-prompt">
                        <p>See AI-generated illustrations of how this lesion may have looked at its earliest stage and how it might progress if left untreated.</p>
                        <button
                          className="generate-images-btn"
                          onClick={() => generateImages(result.id)}
                        >
                          Generate Before & After Images
                        </button>
                      </div>
                    )}

                    {genLoading && (
                      <div className="gen-loading">
                        <span className="spinner" style={{ borderTopColor: "var(--accent)", width: 24, height: 24 }} />
                        <p>Generating before and after images...</p>
                      </div>
                    )}

                    {genImages && !genImages.error && (
                      <>
                        <div className="disclaimer" style={{ marginBottom: "1rem" }}>
                          <span className="disclaimer-icon">&#9432;</span>
                          AI-generated illustrations for educational purposes only. These do not represent your actual lesion.
                        </div>
                        <div className="image-comparison">
                          {genImages.origin_image ? (
                            <div className="comparison-card">
                              <h4>At Origin</h4>
                              <img src={`data:image/png;base64,${genImages.origin_image}`} alt="Early stage" />
                            </div>
                          ) : genImages.origin_error ? (
                            <div className="comparison-card">
                              <h4>At Origin</h4>
                              <p className="error">{genImages.origin_error}</p>
                            </div>
                          ) : null}
                          {genImages.progression_image ? (
                            <div className="comparison-card">
                              <h4>If Untreated (6-12 months)</h4>
                              <img src={`data:image/png;base64,${genImages.progression_image}`} alt="Untreated progression" />
                            </div>
                          ) : genImages.progression_error ? (
                            <div className="comparison-card">
                              <h4>If Untreated</h4>
                              <p className="error">{genImages.progression_error}</p>
                            </div>
                          ) : null}
                        </div>
                      </>
                    )}

                    {genImages?.error && (
                      <p className="error">{genImages.error}</p>
                    )}
                  </div>
                </>
              ) : (
                /* Placeholder cards when no results */
                <div className="card placeholder-card">
                  <div className="placeholder-icon">
                    <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3>Results will appear here</h3>
                  <p>Upload or capture a skin lesion image and click Analyze to see AI predictions across 7 diagnostic classes.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
