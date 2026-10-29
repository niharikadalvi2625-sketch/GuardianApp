# GuardianApp - Python/Flask Backend & SQLite Engine

This backend implements the official requirements specified in your project synopsis:
1. **Frontend**: React Native (Cross-Platform Mobile App)
2. **Backend**: Python / Flask (RESTful APIs for incident feeds, user sync, and AI verification)
3. **Database**: 
   - **Local Mobile Database**: Android Native SQLite (`guardian_local.db`)
   - **Backend Relational Database**: SQLite (`guardian.db`)
   - **Cloud Storage & Sync**: Google Firebase Realtime Database
4. **Maps & GPS**: OpenStreetMap (Overpass API + Nominatim Reverse Geocoding) + Android Native LocationManager
5. **AI/ML**:
   - **NLP Engine**: Multi-lingual Natural Language Processing in `ChatbotScreen.tsx` (English, Hindi, Marathi)
   - **Image Verification**: Computer Vision Hazard Verifier in `ai_verifier.py`

---

## 🚀 How to Run the Backend (For Demo / Viva)

1. Open a command prompt or terminal in the `backend/` folder:
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```
   *(Or double-click `run_backend.bat`)*

2. The server will start at:
   ```
   http://localhost:5000
   ```
3. Test in your browser:
   - Root Overview: `http://localhost:5000/`
   - Health & SQLite Info: `http://localhost:5000/api/health`
   - All Reports (with Distance Calculation): `http://localhost:5000/api/reports?lat=19.6968&lon=72.7655&radius_km=25`
   - SQLite Database Stats: `http://localhost:5000/api/sqlite/info`

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Verifies Flask server health, SQLite connection, and active tables |
| `GET` | `/api/reports` | Returns incident reports with Haversine distance from user's GPS coordinates (`lat`, `lon`, `radius_km`) |
| `POST` | `/api/reports` | Publishes a new incident report and automatically executes AI/ML image verification |
| `POST` | `/api/reports/<id>/confirm` | Increments community confirmation count (upvote) |
| `POST` | `/api/verify-hazard-image` | Direct AI/ML endpoint to analyze incident photos for waterlogging, fire, road obstruction, or darkness |
| `POST` | `/api/sync/backup` | Syncs user profile, contacts, and custom safe havens to SQLite & Firebase |
| `GET` | `/api/sync/restore/<id>` | Restores user backup data from Firebase/SQLite |
| `GET` | `/api/sqlite/info` | Inspects SQLite database file path, version, and row counts |

---

## 🗄️ Database Architecture (SQLite)

- **`reports` table**:
  - `id` (TEXT PRIMARY KEY)
  - `title` (TEXT)
  - `type` (TEXT: `danger`, `hazard`, `blocked_road`, `safe_haven`)
  - `description` (TEXT)
  - `latitude` (REAL), `longitude` (REAL)
  - `locality` (TEXT), `city` (TEXT)
  - `author_name` (TEXT)
  - `timestamp` (TEXT)
  - `confirmations_count` (INTEGER)
  - `image_url` (TEXT)
  - `is_verified` (INTEGER: 0 or 1)
  - `verification_score` (REAL)
  - `detected_hazard` (TEXT)

- **`safe_havens` table**:
  - `id` (TEXT PRIMARY KEY)
  - `name` (TEXT), `category` (TEXT), `address` (TEXT), `phone` (TEXT)
  - `latitude` (REAL), `longitude` (REAL)
  - `is_open_24_hours` (INTEGER), `is_user_added` (INTEGER)

- **`cloud_backups` table**:
  - `user_id` (TEXT PRIMARY KEY)
  - `backup_json` (TEXT)
  - `updated_at` (INTEGER)

---

## 🤖 AI / ML Image Verification Details

Located in `ai_verifier.py`:
- Analyzes color histograms, luminance, edge gradients, and contrast variations:
  - **Waterlogging / Flood**: Analyzes blue/grey reflectance and surface smoothness (confidence: 80% - 94%).
  - **Fire / Smoke**: Analyzes red-orange wavelength dominance and contrast ratio (confidence: 82% - 96%).
  - **Road Obstructions / Debris**: Analyzes high multi-directional edge gradients (confidence: 82% - 93%).
  - **Low-Visibility Danger**: Analyzes low ambient luminance thresholds under 55 cd/m² (confidence: 85% - 95%).

