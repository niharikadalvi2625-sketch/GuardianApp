package com.guardianapp

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class GuardianAlertModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "GuardianAlert"
    }

    private fun getVibrator(): Vibrator? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
        } catch (e: Exception) {
            null
        }
    }

    @ReactMethod
    fun triggerPhoneRingVibrate(promise: Promise) {
        try {
            val vibrator = getVibrator()
            if (vibrator != null && vibrator.hasVibrator()) {
                val pattern = longArrayOf(0, 1200, 1000, 1200, 1000)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(pattern, 1)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(pattern, 1)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopPhoneRingVibrate(promise: Promise) {
        try {
            val vibrator = getVibrator()
            vibrator?.cancel()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun triggerHapticConfirmation(promise: Promise) {
        try {
            val vibrator = getVibrator()
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(50)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openSmsComposer(phone: String, message: String, promise: Promise) {
        try {
            val cleanPhone = phone.replace(Regex("[^0-9+]"), "")
            val uri = if (cleanPhone.isNotEmpty()) {
                android.net.Uri.parse("smsto:$cleanPhone")
            } else {
                android.net.Uri.parse("smsto:")
            }
            val intent = android.content.Intent(android.content.Intent.ACTION_SENDTO, uri).apply {
                putExtra("sms_body", message)
                putExtra(android.content.Intent.EXTRA_TEXT, message)
                putExtra("android.intent.extra.TEXT", message)
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val target = reactContext.currentActivity ?: reactContext
            target.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    private val prefs by lazy {
        reactContext.getSharedPreferences("guardian_app_secure_prefs", Context.MODE_PRIVATE)
    }

    @ReactMethod
    fun setStorageItem(key: String, value: String, promise: Promise) {
        try {
            prefs.edit().putString(key, value).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STORAGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getStorageItem(key: String, promise: Promise) {
        try {
            val value = prefs.getString(key, null)
            promise.resolve(value)
        } catch (e: Exception) {
            promise.reject("STORAGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun removeStorageItem(key: String, promise: Promise) {
        try {
            prefs.edit().remove(key).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STORAGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearStorage(promise: Promise) {
        try {
            prefs.edit().clear().apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STORAGE_ERROR", e.message)
        }
    }
}


