import os, io, json, re, time, uuid, datetime, base64, requests
from PIL import Image, ImageDraw, ImageFont
import numpy as np, tensorflow as tf
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from bson import ObjectId

from mandi_data import get_fallback_mandi_data, resolve_commodity_alias
from db import users_col, tasks_col, serialize_doc, load_local_db, save_local_db

# ------------------------------------------------------------------------------
# 1. Config & MobileNetV3 Model
# ------------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
for env in [os.path.join(BASE_DIR, ".env"), os.path.join(BASE_DIR, "..", ".env")]:
    if os.path.exists(env): load_dotenv(env)

app = Flask(__name__)
CORS(app)

model = tf.keras.models.load_model(os.path.join(BASE_DIR, "plant_disease_mobilenetv3.h5"))
with open(os.path.join(BASE_DIR, "class_names.json")) as f:
    class_names = json.load(f)

def get_api_key():
    return os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("DIAGNOSTIC_API_KEY", "").strip()

def parse_class(raw):
    p, d = raw.split("___", 1) if "___" in raw else (raw, "Unknown")
    return p.replace("_", " ").strip(), d.replace("_", " ").strip()

# ------------------------------------------------------------------------------
# 2. Disease Diagnosis & Visual Pathology Map
# ------------------------------------------------------------------------------
def predict_fast(image):
    preds = model.predict(np.expand_dims(np.array(image.resize((224, 224)), dtype=np.float32), 0), verbose=0)[0]
    top3 = preds.argsort()[-3:][::-1]
    p, c = parse_class(class_names[top3[0]])
    return {
        "plant": p, "condition": c, "confidence": round(float(preds[top3[0]]) * 100, 2),
        "is_healthy": "healthy" in c.lower(),
        "top3": [{"name": " - ".join(parse_class(class_names[i])), "prob": round(float(preds[i]) * 100, 2)} for i in top3],
        "model_used": "Core Neural Classifier"
    }

def find_diseased_regions(image):
    try:
        arr = np.array(image.resize((240, 240)), dtype=np.float32)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        y, x = np.where((g <= r * 1.1) & (r + g + b > 70) & (r + g + b < 640))
        if len(y) > 60:
            ymin, ymax = float(np.percentile(y, 15)) / 240.0, float(np.percentile(y, 85)) / 240.0
            xmin, xmax = float(np.percentile(x, 15)) / 240.0, float(np.percentile(x, 85)) / 240.0
            if (xmax - xmin > 0.15) and (ymax - ymin > 0.15):
                return [{"box_2d": [ymin, xmin, ymax, xmax]}]
    except Exception: pass
    return [{"box_2d": [0.20, 0.20, 0.80, 0.80]}]

def generate_annotated_image(image, condition, boxes=None, is_healthy=False):
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    w, h = annotated.size
    font_size = max(18, min(48, int(min(w, h) * 0.042)))
    font = None
    for fpath in ["C:/Windows/Fonts/arial.ttf", "arial.ttf"]:
        if os.path.exists(fpath):
            try: font = ImageFont.truetype(fpath, font_size); break
            except Exception: pass

    if not is_healthy:
        for item in (boxes or find_diseased_regions(image)):
            box = item.get("box_2d", item) if isinstance(item, dict) else item
            label = item.get("label", condition) if isinstance(item, dict) else condition
            if not box or len(box) != 4: continue
            scale = 1000.0 if max(box) > 1.0 else 1.0
            top, left = int((box[0] / scale) * h), int((box[1] / scale) * w)
            bottom, right = int((box[2] / scale) * h), int((box[3] / scale) * w)
            draw.rectangle([left, top, right, bottom], outline="#ef4444", width=max(3, min(8, int(min(w, h) * 0.008))))
            tag = f"⚠ Affected Area: {label}"
            pad_x, pad_y = int(font_size * 0.4), int(font_size * 0.25)
            try:
                bb = draw.textbbox((left, top), tag, font=font)
                tw, th = bb[2] - bb[0], bb[3] - bb[1]
            except Exception: tw, th = len(tag) * int(font_size * 0.6), font_size + 4
            draw.rectangle([left, max(0, top - th - pad_y * 2), left + tw + pad_x * 2, top], fill="#dc2626")
            draw.text((left + pad_x, max(0, top - th - pad_y * 2) + pad_y), tag, fill="#ffffff", font=font)
    else:
        pad = int(font_size * 0.5)
        draw.rectangle([10, 10, 10 + int(font_size * 8), 10 + int(font_size * 2)], fill="#16a34a")
        draw.text((10 + pad, 10 + int(pad * 0.5)), "✓ Healthy Foliage", fill="#ffffff", font=font)

    buf = io.BytesIO()
    annotated.save(buf, format="JPEG", quality=88)
    return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"

def predict_deep(image):
    api_key = get_api_key()
    if not api_key: raise ValueError("No API key")
    thumb = image.copy()
    thumb.thumbnail((300, 300))
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=70)

    prompt = (
        "Plant pathologist analysis in JSON only:\n"
        '{"plant": "...", "condition": "...", "is_healthy": false, "confidence": 95, '
        '"affected_area": "...", "boxes": [{"box_2d": [ymin, xmin, ymax, xmax], "label": "..."}], '
        '"explanation": "...", "remedies": {"organic": "...", "chemical": "...", "prevention": "..."}}\n'
        "box_2d integers 0-1000."
    )
    payload = {"contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}}]}]}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
    resp = requests.post(url, json=payload, timeout=12)
    if resp.status_code == 200:
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        data = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip())
        data["model_used"] = "Deep Vision Pathologist"
        conf = float(data.get("confidence", 95))
        data["confidence"] = round(conf * 100 if conf <= 1.0 else conf, 2)
        data.setdefault("affected_area", "Visible lesion spots on foliage")
        data["regenerated_image"] = generate_annotated_image(image, data["condition"], data.get("boxes", []), data.get("is_healthy", False))
        return data
    raise RuntimeError("Diagnostic service unavailable.")

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files or not request.files["file"].filename:
        return jsonify({"error": "No image uploaded"}), 400
    image = Image.open(request.files["file"].stream).convert("RGB")
    if request.form.get("engine", "deep") != "deep" or not get_api_key():
        return jsonify(predict_fast(image))
    try:
        return jsonify(predict_deep(image))
    except Exception:
        res = predict_fast(image)
        res["affected_area"] = "Diseased lesions detected on foliage surface"
        res["regenerated_image"] = generate_annotated_image(image, res["condition"], find_diseased_regions(image), res["is_healthy"])
        res["warning"] = "Cloud diagnosis busy. Switched to Core Neural Classifier."
        return jsonify(res)

@app.route("/api/remedies", methods=["POST"])
def get_remedies():
    data, api_key = request.get_json() or {}, get_api_key()
    if not api_key: return jsonify({"error": "Service unavailable"}), 503
    p, c = data.get("plant", "Plant"), data.get("condition", "Disease")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": f"Remedies for {p} {c}. Return JSON: {{\"organic\": \"...\", \"chemical\": \"...\", \"prevention\": \"...\"}}"}]}]}
    try:
        resp = requests.post(url, json=payload, timeout=6)
        if resp.status_code == 200:
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            return jsonify({"status": "ok", "remedies": json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip())})
    except Exception: pass
    return jsonify({"error": "Failed to generate remedies"}), 500

# ------------------------------------------------------------------------------
# 3. Mandi Market Rates
# ------------------------------------------------------------------------------
mandi_cache = {}

def fetch_mandi_prices(state="", commodity="", page=1, limit=12):
    key = (state.lower().strip(), commodity.lower().strip(), page, limit)
    now = time.time()
    if key in mandi_cache and now - mandi_cache[key][0] < 900:
        res = dict(mandi_cache[key][1]); res["cached"] = True; return res

    canonical, alias_note = resolve_commodity_alias(commodity)
    api_key = os.getenv("DATA_GOV_IN_API_KEY", "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b")
    params = {"api-key": api_key, "format": "json", "offset": (page - 1) * limit, "limit": limit}
    if state and state.lower() != "all": params["filters[state]"] = state
    if canonical and canonical.lower() != "all": params["filters[commodity]"] = canonical

    data = None
    try:
        r = requests.get("https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070", params=params, timeout=4)
        if r.status_code == 200:
            raw = r.json()
            recs = [
                {
                    "state": x.get("state") or x.get("State", ""), "district": x.get("district") or x.get("District", ""),
                    "market": x.get("market") or x.get("Market", ""), "commodity": x.get("commodity") or x.get("Commodity", ""),
                    "variety": x.get("variety") or x.get("Variety", "Common"), "arrival_date": x.get("arrival_date") or x.get("Arrival_Date", ""),
                    "min_price": float(x.get("min_price") or x.get("Min_Price") or 0),
                    "max_price": float(x.get("max_price") or x.get("Max_Price") or 0),
                    "modal_price": float(x.get("modal_price") or x.get("Modal_Price") or 0),
                } for x in raw.get("records", [])
            ]
            if recs:
                data = {"records": recs, "total": int(raw.get("total", len(recs))), "page": page, "limit": limit, "alias_used": alias_note, "canonical_commodity": canonical, "source": "data.gov.in (Live Agmarknet)", "cached": False}
    except Exception: pass

    data = data or get_fallback_mandi_data(state=state, commodity=commodity, page=page, limit=limit)
    mandi_cache[key] = (now, data)
    return data

@app.route("/api/mandi")
def get_mandi():
    state, commodity = request.args.get("state", "").strip(), request.args.get("commodity", "").strip()
    try: page, limit = max(1, int(request.args.get("page", 1))), min(50, max(1, int(request.args.get("limit", 12))))
    except ValueError: page, limit = 1, 12
    return jsonify(fetch_mandi_prices(state=state, commodity=commodity, page=page, limit=limit))

# ------------------------------------------------------------------------------
# 4. Farmer Kanban Board (Clerk Auth + MongoDB Atlas / Local Store)
# ------------------------------------------------------------------------------
def get_current_user():
    clerk_id = request.headers.get("x-clerk-user-id", "").strip()
    if not clerk_id:
        return {"_id": "demo_farmer", "username": "demo_farmer", "name": "Demo Farmer"} if "demo_farmer" in request.headers.get("Authorization", "") else None
    name = request.headers.get("x-clerk-user-name", "").strip() or "Farmer"
    try:
        if users_col is not None:
            user = users_col.find_one({"clerk_id": clerk_id})
            if not user:
                doc = {"clerk_id": clerk_id, "username": clerk_id, "name": name, "created_at": datetime.datetime.utcnow().isoformat()}
                users_col.insert_one(doc); user = doc
            user["_id"] = str(user["_id"]); return user
    except Exception: pass

    local = load_local_db()
    users = local.setdefault("users", {})
    if clerk_id not in users:
        users[clerk_id] = {"_id": clerk_id, "clerk_id": clerk_id, "username": clerk_id, "name": name}
        save_local_db(local)
    return users[clerk_id]

@app.route("/api/kanban/tasks", methods=["GET", "POST"])
def kanban_tasks():
    user = get_current_user()
    if not user: return jsonify({"error": "Authentication required"}), 401
    uid = str(user["_id"])

    if request.method == "GET":
        try:
            if tasks_col is not None:
                return jsonify({"status": "ok", "tasks": [serialize_doc(d) for d in tasks_col.find({"user_id": uid}).sort("created_at", 1)]})
        except Exception: pass
        return jsonify({"status": "ok", "tasks": [t for t in load_local_db().get("tasks", []) if t.get("user_id") == uid]})

    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title: return jsonify({"error": "Title required"}), 400

    task = {
        "user_id": uid, "title": title, "crop": data.get("crop", "").strip(),
        "column": data.get("column", "planning").strip(), "priority": data.get("priority", "medium").strip(),
        "dueDate": data.get("dueDate", "").strip(), "notes": data.get("notes", "").strip(),
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    try:
        if tasks_col is not None:
            task["_id"] = str(tasks_col.insert_one(dict(task)).inserted_id)
    except Exception: pass
    task.setdefault("_id", uuid.uuid4().hex[:24])

    local = load_local_db()
    local["tasks"] = [t for t in local.get("tasks", []) if t.get("_id") != task["_id"]] + [task]
    save_local_db(local)
    return jsonify({"status": "ok", "task": task}), 201

@app.route("/api/kanban/tasks/<task_id>", methods=["PUT", "DELETE"])
def kanban_task_item(task_id):
    user = get_current_user()
    if not user: return jsonify({"error": "Authentication required"}), 401
    uid = str(user["_id"])

    if request.method == "PUT":
        updates = {k: v for k, v in (request.get_json() or {}).items() if k in ["title", "crop", "column", "priority", "dueDate", "notes"]}
        try:
            if tasks_col is not None:
                tasks_col.update_one({"user_id": uid, "_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id}, {"$set": updates})
        except Exception: pass
        local = load_local_db()
        for t in local.get("tasks", []):
            if t.get("_id") == task_id or (task_id.startswith("temp-") and t.get("title") == updates.get("title")):
                t.update(updates); break
        save_local_db(local)
        return jsonify({"status": "ok", "task": updates})

    # DELETE
    try:
        if tasks_col is not None:
            if ObjectId.is_valid(task_id): tasks_col.delete_one({"_id": ObjectId(task_id), "user_id": uid})
            tasks_col.delete_one({"_id": task_id, "user_id": uid})
    except Exception: pass
    local = load_local_db()
    local["tasks"] = [t for t in local.get("tasks", []) if t.get("_id") != task_id]
    save_local_db(local)
    return jsonify({"status": "ok", "deleted_id": task_id})

# ------------------------------------------------------------------------------
# 5. Static Frontend Delivery & Entrypoint
# ------------------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    dist = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
    target = os.path.join(dist, path) if path else os.path.join(dist, "index.html")
    return send_file(target) if os.path.exists(target) else send_file(os.path.join(dist, "index.html"))

if __name__ == "__main__":
    print("Backend running at: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
