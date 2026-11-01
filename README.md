# 🌿 Plant Disease Detection & Diagnosis Platform

An end-to-end Deep Learning & Vision AI application for identifying plant diseases and recommending treatment remedies. Combines a fast offline neural classifier (38 PlantVillage classes) with an advanced multi-modal diagnostic engine behind a modern **React 18** web dashboard.

---

## 📁 Project Structure

```text
plant_disease_detection/
│
├── backend/
│   ├── app.py                      # Flask API & static web server
│   ├── train.py                    # Neural model training script
│   ├── plant_disease_mobilenetv3.h5# Trained model weights
│   ├── class_names.json            # 38 plant disease class labels
│   ├── requirements.txt            # Python dependencies
│   └── .env                        # Local environment variables
│
├── frontend/                       # Vite + React 18 frontend
│   ├── dist/                       # Built bundle served by Flask
│   ├── src/                        # React source components & styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── plantvillage dataset/
│   └── color/                      # 38 plant classes (~54,000 leaf images)
│
├── .env                            # Root environment file (optional mirror)
├── .gitignore                      # Git ignore configuration
└── README.md                       # Documentation & Project Guide
```

---

## 🚀 Quick Start Guide

### 1. Install Backend Dependencies
```bash
py -3.10 -m pip install -r backend/requirements.txt
```

### 2. Configure Environment Key (Optional)
Create or edit `.env` in `backend/.env`:
```env
GEMINI_API_KEY=your_key_here
```
*(If no key is configured, the system automatically runs the local offline neural classification model.)*

### 3. Launch the Application
Start the Flask server from either the project root or inside `backend/`:
```bash
py -3.10 backend/app.py
```
Open your browser and navigate to:
👉 **`http://127.0.0.1:5000`**

---

## 💻 Model Training

### Retrain the Classification Model
Train the model on the PlantVillage dataset:
```bash
py -3.10 backend/train.py
```
- **Default Parameters:** 10 epochs, batch size 32, image size 224x224.
- Weights will be saved to `backend/plant_disease_mobilenetv3.h5`.

---

## 🖥️ Frontend Development

The frontend is built with **React 18** and **Vite**:
```bash
cd frontend
npm install

# Start Vite dev server with backend proxy (http://localhost:5173)
npm run dev

# Rebuild production assets into frontend/dist
npm run build
```

---

## 🧠 How the System Works

1. **Dual-Engine Architecture**:
   - **Deep Diagnostic Mode**: Identifies obscure symptoms, provides visual observation explanations, and generates structured treatment plans (Organic, Chemical, and Prevention advice).
   - **Fast Scan Mode**: Lightweight local model with 38 plant disease classes, 97%+ validation accuracy, running entirely on CPU/GPU without internet.

2. **Automatic Fallback**:
   - If the cloud pipeline is busy or unavailable, the server seamlessly falls back to the local neural classifier with a user notification banner.

3. **Robust Dynamic Path Resolution**:
   - All backend scripts anchor paths to `BASE_DIR = os.path.dirname(os.path.abspath(__file__))`, allowing execution from any directory without `FileNotFoundError`.

---

## 🎓 Viva & Technical Q&A

### Q1: Why MobileNetV3 instead of ResNet or VGG16?
- Traditional architectures like VGG16 (138M params) or ResNet50 (25M params) are heavy and slow.
- MobileNetV3 uses **Depthwise Separable Convolutions** and **Squeeze-and-Excitation (SE)** attention modules with **only ~2.5M parameters** (over 95% smaller than VGG), making it ideal for edge devices and mobile farm equipment.

### Q2: What Loss Function and Optimizer are used?
- **Loss**: `Sparse Categorical Crossentropy` (labels are integer indices 0–37 rather than one-hot vectors, minimizing memory overhead).
- **Optimizer**: `Adam` with learning rate `0.0005`.
