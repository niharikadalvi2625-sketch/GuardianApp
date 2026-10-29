package com.guardianapp

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

class GuardianSQLiteModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "GuardianSQLite"
    }

    private class DatabaseHelper(context: Context) :
        SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

        companion object {
            const val DATABASE_NAME = "guardian_local.db"
            const val DATABASE_VERSION = 1

            const val TABLE_REPORTS = "safety_reports"
            const val TABLE_SAFE_HAVENS = "safe_havens"
            const val TABLE_KV_STORE = "kv_store"
        }

        override fun onCreate(db: SQLiteDatabase) {
            // 1. Safety Reports Table (Local offline reports)
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS $TABLE_REPORTS (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT,
                    latitude REAL,
                    longitude REAL,
                    locality TEXT,
                    city TEXT,
                    author_name TEXT,
                    timestamp TEXT,
                    confirmations_count INTEGER DEFAULT 1,
                    image_url TEXT,
                    is_verified INTEGER DEFAULT 0,
                    verification_score REAL DEFAULT 0.0,
                    detected_hazard TEXT
                );
                """.trimIndent()
            )

            // 2. Safe Havens / Shelters Table
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS $TABLE_SAFE_HAVENS (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    address TEXT,
                    phone TEXT,
                    latitude REAL,
                    longitude REAL,
                    is_open_24_hours INTEGER DEFAULT 1,
                    is_user_added INTEGER DEFAULT 0
                );
                """.trimIndent()
            )

            // 3. Generic Key-Value Table for local offline preferences
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS $TABLE_KV_STORE (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
                """.trimIndent()
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            db.execSQL("DROP TABLE IF EXISTS $TABLE_REPORTS")
            db.execSQL("DROP TABLE IF EXISTS $TABLE_SAFE_HAVENS")
            db.execSQL("DROP TABLE IF EXISTS $TABLE_KV_STORE")
            onCreate(db)
        }
    }

    private val dbHelper = DatabaseHelper(reactContext)

    /**
     * Inserts or replaces a safety report into SQLite database
     */
    @ReactMethod
    fun sqliteInsertReport(reportJsonStr: String, promise: Promise) {
        try {
            val json = JSONObject(reportJsonStr)
            val db = dbHelper.writableDatabase
            val values = ContentValues().apply {
                put("id", json.optString("id"))
                put("title", json.optString("title"))
                put("type", json.optString("type"))
                put("description", json.optString("description"))
                put("latitude", json.optDouble("latitude", 0.0))
                put("longitude", json.optDouble("longitude", 0.0))
                put("locality", json.optString("locality"))
                put("city", json.optString("city"))
                put("author_name", json.optString("authorName", "Nearby Citizen"))
                put("timestamp", json.optString("timestamp"))
                put("confirmations_count", json.optInt("confirmationsCount", 1))
                put("image_url", json.optString("imageUrl", ""))
                put("is_verified", if (json.optBoolean("isVerified", false)) 1 else 0)
                put("verification_score", json.optDouble("verificationScore", 0.0))
                put("detected_hazard", json.optString("detectedHazard", ""))
            }
            val rowId = db.insertWithOnConflict(
                DatabaseHelper.TABLE_REPORTS,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
            )
            promise.resolve(rowId > 0)
        } catch (e: Exception) {
            promise.reject("SQLITE_INSERT_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Retrieves all safety reports from SQLite database
     */
    @ReactMethod
    fun sqliteGetReports(promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery("SELECT * FROM ${DatabaseHelper.TABLE_REPORTS} ORDER BY timestamp DESC", null)
            val jsonArray = JSONArray()

            while (cursor.moveToNext()) {
                val item = JSONObject().apply {
                    put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")))
                    put("title", cursor.getString(cursor.getColumnIndexOrThrow("title")))
                    put("type", cursor.getString(cursor.getColumnIndexOrThrow("type")))
                    put("description", cursor.getString(cursor.getColumnIndexOrThrow("description")))
                    put("latitude", cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")))
                    put("longitude", cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")))
                    put("locality", cursor.getString(cursor.getColumnIndexOrThrow("locality")))
                    put("city", cursor.getString(cursor.getColumnIndexOrThrow("city")))
                    put("authorName", cursor.getString(cursor.getColumnIndexOrThrow("author_name")))
                    put("timestamp", cursor.getString(cursor.getColumnIndexOrThrow("timestamp")))
                    put("confirmationsCount", cursor.getInt(cursor.getColumnIndexOrThrow("confirmations_count")))
                    put("imageUrl", cursor.getString(cursor.getColumnIndexOrThrow("image_url")))
                    put("isVerified", cursor.getInt(cursor.getColumnIndexOrThrow("is_verified")) == 1)
                    put("verificationScore", cursor.getDouble(cursor.getColumnIndexOrThrow("verification_score")))
                    val hazardCol = cursor.getColumnIndex("detected_hazard")
                    if (hazardCol >= 0 && !cursor.isNull(hazardCol)) {
                        put("detectedHazard", cursor.getString(hazardCol))
                    }
                }
                jsonArray.put(item)
            }
            cursor.close()
            promise.resolve(jsonArray.toString())
        } catch (e: Exception) {
            promise.reject("SQLITE_QUERY_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Deletes a report from SQLite
     */
    @ReactMethod
    fun sqliteDeleteReport(id: String, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val count = db.delete(DatabaseHelper.TABLE_REPORTS, "id = ?", arrayOf(id))
            promise.resolve(count > 0)
        } catch (e: Exception) {
            promise.reject("SQLITE_DELETE_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Inserts or replaces a custom safe haven in SQLite
     */
    @ReactMethod
    fun sqliteInsertSafeHaven(havenJsonStr: String, promise: Promise) {
        try {
            val json = JSONObject(havenJsonStr)
            val db = dbHelper.writableDatabase
            val values = ContentValues().apply {
                put("id", json.optString("id"))
                put("name", json.optString("name"))
                put("category", json.optString("category", "shelter"))
                put("address", json.optString("address"))
                put("phone", json.optString("phone", "112"))
                put("latitude", json.optDouble("latitude", 0.0))
                put("longitude", json.optDouble("longitude", 0.0))
                put("is_open_24_hours", if (json.optBoolean("isOpen24Hours", true)) 1 else 0)
                put("is_user_added", if (json.optBoolean("isUserAdded", true)) 1 else 0)
            }
            val rowId = db.insertWithOnConflict(
                DatabaseHelper.TABLE_SAFE_HAVENS,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
            )
            promise.resolve(rowId > 0)
        } catch (e: Exception) {
            promise.reject("SQLITE_HAVEN_INSERT_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Retrieves all custom safe havens from SQLite
     */
    @ReactMethod
    fun sqliteGetSafeHavens(promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery("SELECT * FROM ${DatabaseHelper.TABLE_SAFE_HAVENS}", null)
            val jsonArray = JSONArray()

            while (cursor.moveToNext()) {
                val item = JSONObject().apply {
                    put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")))
                    put("name", cursor.getString(cursor.getColumnIndexOrThrow("name")))
                    put("category", cursor.getString(cursor.getColumnIndexOrThrow("category")))
                    put("address", cursor.getString(cursor.getColumnIndexOrThrow("address")))
                    put("phone", cursor.getString(cursor.getColumnIndexOrThrow("phone")))
                    put("latitude", cursor.getDouble(cursor.getColumnIndexOrThrow("latitude")))
                    put("longitude", cursor.getDouble(cursor.getColumnIndexOrThrow("longitude")))
                    put("isOpen24Hours", cursor.getInt(cursor.getColumnIndexOrThrow("is_open_24_hours")) == 1)
                    put("isUserAdded", cursor.getInt(cursor.getColumnIndexOrThrow("is_user_added")) == 1)
                }
                jsonArray.put(item)
            }
            cursor.close()
            promise.resolve(jsonArray.toString())
        } catch (e: Exception) {
            promise.reject("SQLITE_HAVEN_QUERY_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Stores a key-value pair in SQLite
     */
    @ReactMethod
    fun sqliteSetItem(key: String, value: String, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val values = ContentValues().apply {
                put("key", key)
                put("value", value)
            }
            db.insertWithOnConflict(
                DatabaseHelper.TABLE_KV_STORE,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SQLITE_KV_SET_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Gets a key-value pair from SQLite
     */
    @ReactMethod
    fun sqliteGetItem(key: String, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery("SELECT value FROM ${DatabaseHelper.TABLE_KV_STORE} WHERE key = ?", arrayOf(key))
            var result: String? = null
            if (cursor.moveToFirst()) {
                result = cursor.getString(0)
            }
            cursor.close()
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SQLITE_KV_GET_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Removes a key from SQLite
     */
    @ReactMethod
    fun sqliteRemoveItem(key: String, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            db.delete(DatabaseHelper.TABLE_KV_STORE, "key = ?", arrayOf(key))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SQLITE_KV_REMOVE_ERROR", e.localizedMessage, e)
        }
    }

    /**
     * Returns SQLite database metadata (for academic / viva project verification)
     */
    @ReactMethod
    fun sqliteGetDatabaseInfo(promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val map = Arguments.createMap()
            map.putString("databaseName", DatabaseHelper.DATABASE_NAME)
            map.putInt("version", DatabaseHelper.DATABASE_VERSION)
            map.putString("path", db.path)
            map.putBoolean("isOpen", db.isOpen)

            val tablesArray = Arguments.createArray()
            val cursor = db.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", null)
            while (cursor.moveToNext()) {
                tablesArray.pushString(cursor.getString(0))
            }
            cursor.close()
            map.putArray("tables", tablesArray)

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("SQLITE_INFO_ERROR", e.localizedMessage, e)
        }
    }
}
