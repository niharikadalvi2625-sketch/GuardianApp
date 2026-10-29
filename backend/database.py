"""
GuardianApp Backend - SQLite Database Layer
Handles local and server-side relational persistence for safety reports,
safe havens, user profiles, and cloud backup snapshots.
"""

import sqlite3
import os
import math
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), 'guardian.db')


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes SQLite database tables and seeds initial sample records."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Safety Reports Table (Crowd-sourced incidents & hazard reports)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        locality TEXT,
        city TEXT,
        author_name TEXT,
        timestamp TEXT NOT NULL,
        confirmations_count INTEGER DEFAULT 1,
        image_url TEXT,
        is_verified INTEGER DEFAULT 0,
        verification_score REAL DEFAULT 0.0,
        detected_hazard TEXT
    );
    """)

    # 2. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        provider TEXT DEFAULT 'google',
        created_at INTEGER,
        last_login_at INTEGER
    );
    """)

    # 3. Safe Havens / Shelters Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS safe_havens (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        is_open_24_hours INTEGER DEFAULT 1,
        is_user_added INTEGER DEFAULT 0
    );
    """)

    # 4. Cloud Backup Snapshots Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cloud_backups (
        user_id TEXT PRIMARY KEY,
        backup_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );
    """)

    conn.commit()

    # Seed initial localized hazard data if empty
    cursor.execute("SELECT COUNT(*) FROM reports;")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_initial_data(conn)

    conn.close()


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Haversine distance in kilometers between two GPS coordinates."""
    r = 6371.0  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def insert_report(data: Dict[str, Any]) -> Dict[str, Any]:
    """Inserts a new incident report into SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    report_id = data.get('id') or f"rep_{int(datetime.now().timestamp() * 1000)}"
    timestamp = data.get('timestamp') or datetime.utcnow().isoformat() + "Z"

    cursor.execute("""
    INSERT INTO reports (
        id, title, type, description, latitude, longitude,
        locality, city, author_name, timestamp, confirmations_count,
        image_url, is_verified, verification_score, detected_hazard
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        confirmations_count = excluded.confirmations_count,
        is_verified = excluded.is_verified,
        verification_score = excluded.verification_score;
    """, (
        report_id,
        data.get('title', 'Hazard Alert'),
        data.get('type', 'hazard'),
        data.get('description', ''),
        float(data.get('latitude', 0.0)),
        float(data.get('longitude', 0.0)),
        data.get('locality', 'Neighborhood'),
        data.get('city', 'My City'),
        data.get('author_name', 'Nearby Citizen'),
        timestamp,
        int(data.get('confirmations_count', 1)),
        data.get('image_url', ''),
        1 if data.get('is_verified') else 0,
        float(data.get('verification_score', 0.0)),
        data.get('detected_hazard', '')
    ))

    conn.commit()
    conn.close()

    data['id'] = report_id
    data['timestamp'] = timestamp
    return data


def get_reports(
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    radius_km: Optional[float] = 25.0,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves reports from SQLite, computes distances, and filters by proximity."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM reports"
    params = []

    if category and category != 'all':
        query += " WHERE type = ?"
        params.append(category)

    query += " ORDER BY timestamp DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        item = dict(row)
        item['is_verified'] = bool(item['is_verified'])

        if user_lat is not None and user_lon is not None:
            dist = haversine_distance(user_lat, user_lon, item['latitude'], item['longitude'])
            item['distanceKm'] = dist

            # Apply radius filter if specified
            if radius_km is not None and dist > radius_km:
                continue
        else:
            item['distanceKm'] = None

        results.append(item)

    # Sort closest first if coordinates are available
    if user_lat is not None and user_lon is not None:
        results.sort(key=lambda r: (r['distanceKm'] if r['distanceKm'] is not None else 999999))

    return results


def confirm_report(report_id: str) -> Optional[int]:
    """Increments community confirmation / upvote count for a report in SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    UPDATE reports
    SET confirmations_count = confirmations_count + 1
    WHERE id = ?;
    """, (report_id,))

    conn.commit()

    cursor.execute("SELECT confirmations_count FROM reports WHERE id = ?;", (report_id,))
    row = cursor.fetchone()
    conn.close()

    return row[0] if row else None


def save_cloud_backup(user_id: str, backup_json: str):
    """Saves user's emergency backup JSON to SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO cloud_backups (user_id, backup_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        backup_json = excluded.backup_json,
        updated_at = excluded.updated_at;
    """, (user_id, backup_json, int(datetime.now().timestamp() * 1000)))
    conn.commit()
    conn.close()


def get_cloud_backup(user_id: str) -> Optional[str]:
    """Retrieves user's emergency backup JSON from SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT backup_json FROM cloud_backups WHERE user_id = ?;", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None


def seed_initial_data(conn: sqlite3.Connection):
    """Seeds realistic safety hazard records."""
    cursor = conn.cursor()
    sample_reports = [
        (
            'rep_seed_1',
            'Waterlogged Underpass Subway',
            'blocked_road',
            'Subway connector flooded with 2.5 ft standing water. Light vehicles and 2-wheelers diverted.',
            19.6968, 72.7655,
            'Central Subway Road', 'Palghar', 'Traffic Cell Volunteer',
            datetime.utcnow().isoformat() + "Z",
            8, '', 1, 0.94, 'Waterlogging & Flood'
        ),
        (
            'rep_seed_2',
            'Streetlight Failure & Dark Corridor',
            'danger',
            'Main streetlights unpowered along 400m stretch. Low visibility after sunset, travel in groups.',
            19.7020, 72.7690,
            'Mahim Road', 'Palghar', 'Safety Watch Observer',
            datetime.utcnow().isoformat() + "Z",
            5, '', 1, 0.88, 'Low Visibility Hazard'
        ),
        (
            'rep_seed_3',
            'Community First-Aid & Safe Shelter Haven',
            'safe_haven',
            'Clean water, basic medical dressing, emergency wireless relay, and shelter accessible 24/7.',
            19.6940, 72.7610,
            'Community Hall', 'Palghar', 'Disaster Action Team',
            datetime.utcnow().isoformat() + "Z",
            14, '', 1, 0.98, 'Verified Safe Shelter'
        )
    ]

    cursor.executemany("""
    INSERT INTO reports (
        id, title, type, description, latitude, longitude,
        locality, city, author_name, timestamp, confirmations_count,
        image_url, is_verified, verification_score, detected_hazard
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, sample_reports)

    conn.commit()

