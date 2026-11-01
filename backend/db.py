import os
import json
import certifi
import dns.resolver
from pymongo import MongoClient
from dotenv import load_dotenv

# Ensure robust DNS SRV resolution on Windows
try:
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://msyashas01_db_user:e97Be45Vw0fiEvEg@plantdiseasedetection.cvs7nie.mongodb.net/?retryWrites=true&w=majority"
)

# Connect to MongoDB Atlas with low timeout (2000ms) to fail fast to local store if offline/unwhitelisted
try:
    client = MongoClient(
        MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=2000
    )
    db = client["plant_disease_db"]
    users_col = db["users"]
    tasks_col = db["kanban_tasks"]
except Exception:
    client = None
    db = None
    users_col = None
    tasks_col = None

# Local persistent JSON storage fallback
LOCAL_DB_FILE = os.path.join(BASE_DIR, "local_kanban_db.json")

def load_local_db():
    if os.path.exists(LOCAL_DB_FILE):
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"users": {}, "tasks": []}

def save_local_db(data):
    try:
        with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

def serialize_doc(doc):
    """Converts a document to a JSON-serializable dict."""
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        d["_id"] = str(d["_id"])
    return d
