"""
GuardianApp - Python / Flask REST API Backend
Provides backend services for:
1. Incident & Hazard Reports API (proximity-based geospatial filtering)
2. AI/ML Image Verification for crowd-sourced incident photos
3. SQLite Relational Database Engine (guardian.db)
4. Firebase Cloud Synchronization & User Backup
"""

import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import (
    init_db,
    insert_report,
    get_reports,
    confirm_report,
    save_cloud_backup,
    get_cloud_backup,
    get_db_connection,
    DB_FILE
)
from ai_verifier import HazardImageVerifier
from firebase_sync import FirebaseSyncManager

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for React Native mobile clients

# Initialize SQLite database on startup
init_db()


@app.route('/', methods=['GET'])
def root():
    return jsonify({
        "app": "GuardianApp Emergency Safety Platform API",
        "version": "2.2.0",
        "framework": "Python / Flask",
        "database": "SQLite (guardian.db)",
        "cloud_sync": "Firebase Realtime Database & Cloud Storage",
        "ai_ml": "Computer Vision Hazard Verifier & Multi-lingual NLP Engine",
        "endpoints": [
            "GET /api/health",
            "GET /api/reports?lat=<float>&lon=<float>&radius_km=<float>&category=<str>",
            "POST /api/reports",
            "POST /api/reports/<id>/confirm",
            "POST /api/verify-hazard-image",
            "POST /api/sync/backup",
            "GET /api/sync/restore/<user_id>",
            "GET /api/sqlite/info"
        ]
    })


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint providing server and database readiness."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        "status": "healthy",
        "database": {
            "type": "SQLite3",
            "file": DB_FILE,
            "connected": True,
            "active_tables": tables
        },
        "ai_module_ready": True
    })


@app.route('/api/reports', methods=['GET'])
def list_reports():
    """
    Returns incident reports filtered by proximity to the user's GPS coordinates.
    Query params:
      - lat: user latitude (float)
      - lon: user longitude (float)
      - radius_km: search radius in km (float, default 25.0)
      - category: hazard category filter (str, default 'all')
    """
    try:
        lat = float(request.args.get('lat')) if request.args.get('lat') else None
        lon = float(request.args.get('lon')) if request.args.get('lon') else None
        radius_km = float(request.args.get('radius_km', 25.0)) if request.args.get('radius_km') else None
        category = request.args.get('category', 'all')

        reports = get_reports(user_lat=lat, user_lon=lon, radius_km=radius_km, category=category)
        return jsonify({
            "success": True,
            "count": len(reports),
            "scope": {
                "latitude": lat,
                "longitude": lon,
                "radius_km": radius_km,
                "category": category
            },
            "reports": reports
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/reports', methods=['POST'])
def create_report():
    """
    Publishes a new crowd safety hazard report.
    Automatically runs AI/ML image verification if an incident photo is attached.
    """
    data = request.get_json(silent=True) or {}
    if not data.get('title'):
        return jsonify({"success": False, "error": "Title is required"}), 400

    # Auto-run AI verification if photo or base64 attached
    image_input = data.get('image_base64') or data.get('image_url')
    if image_input:
        verification = HazardImageVerifier.verify_image(
            image_input=image_input,
            expected_type=data.get('type', 'hazard')
        )
        data['is_verified'] = verification.get('verified', True)
        data['verification_score'] = verification.get('confidence_score', 0.85)
        data['detected_hazard'] = verification.get('detected_hazard', 'Hazardous Condition')
    else:
        # Default verification score for user reports
        data['is_verified'] = False
        data['verification_score'] = 0.50
        data['detected_hazard'] = 'Unverified Crowd Report'

    created = insert_report(data)
    return jsonify({
        "success": True,
        "message": "Report published to SQLite and community feed.",
        "report": created
    }), 201


@app.route('/api/reports/<report_id>/confirm', methods=['POST'])
def confirm_incident(report_id):
    """Upvotes/confirms that an incident is actively present."""
    new_count = confirm_report(report_id)
    if new_count is not None:
        return jsonify({
            "success": True,
            "report_id": report_id,
            "confirmations_count": new_count
        })
    return jsonify({"success": False, "error": "Report not found"}), 404


@app.route('/api/verify-hazard-image', methods=['POST'])
def verify_image_endpoint():
    """
    Direct AI/ML endpoint to analyze an incident image and detect hazard features.
    Accepts: { "image_base64": "...", "type": "blocked_road" | "danger" | "hazard" }
    """
    data = request.get_json(silent=True) or {}
    image_base64 = data.get('image_base64') or data.get('image')

    if not image_base64:
        return jsonify({
            "success": False,
            "error": "image_base64 string or image file is required"
        }), 400

    result = HazardImageVerifier.verify_image(
        image_input=image_base64,
        expected_type=data.get('type', 'hazard')
    )

    return jsonify({
        "success": True,
        "analysis": result
    })


@app.route('/api/sync/backup', methods=['POST'])
def sync_backup():
    """
    Cloud sync endpoint: saves user backup to SQLite and mirrors to Firebase.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId')
    if not user_id:
        return jsonify({"success": False, "error": "userId is required"}), 400

    # 1. Save locally in SQLite
    save_cloud_backup(user_id, json.dumps(data))

    # 2. Mirror to Firebase
    firebase_res = FirebaseSyncManager.sync_backup_to_firebase(user_id, data)

    return jsonify({
        "success": True,
        "sqlite_persisted": True,
        "firebase_sync": firebase_res
    })


@app.route('/api/sync/restore/<user_id>', methods=['GET'])
def restore_backup(user_id):
    """
    Restores user backup data from Firebase or SQLite fallback.
    """
    # Try Firebase first
    fb_data = FirebaseSyncManager.restore_from_firebase(user_id)
    if fb_data:
        return jsonify({"success": True, "source": "firebase", "data": fb_data})

    # Fallback to SQLite
    sqlite_data = get_cloud_backup(user_id)
    if sqlite_data:
        return jsonify({"success": True, "source": "sqlite", "data": json.loads(sqlite_data)})

    return jsonify({"success": False, "error": "No backup found"}), 404


@app.route('/api/sqlite/info', methods=['GET'])
def sqlite_info():
    """Returns detailed SQLite database structure and statistics."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM reports;")
    reports_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM cloud_backups;")
    backups_count = cursor.fetchone()[0]

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "database": "SQLite",
        "filename": os.path.basename(DB_FILE),
        "full_path": DB_FILE,
        "tables": tables,
        "counts": {
            "reports": reports_count,
            "cloud_backups": backups_count
        }
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Starting GuardianApp Python/Flask Backend on port {port}...")
    print(f"[*] SQLite Database: {DB_FILE}")
    app.run(host='0.0.0.0', port=port, debug=True)

