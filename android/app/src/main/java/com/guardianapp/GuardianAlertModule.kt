package com.guardianapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class GuardianAlertModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "GuardianAlert"
    }

    private var powerPressTimes = ArrayList<Long>()
    private var isPowerReceiverRegistered = false

    private val NOTIFICATION_ID = 9119
    private val CHANNEL_ID = "guardian_emergency_channel"

    private val powerButtonReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action
            if (action == Intent.ACTION_SCREEN_OFF || action == Intent.ACTION_SCREEN_ON) {
                val now = System.currentTimeMillis()
                powerPressTimes.removeAll { now - it > 3000 }
                powerPressTimes.add(now)

                // 3 screen on/off toggles within 3 seconds indicates triple power-button press
                if (powerPressTimes.size >= 3) {
                    powerPressTimes.clear()
                    triggerUrgentHapticPulse()
                    emitEvent("onGuardianPowerTriggerDetected", null)
                }
            }
        }
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

    private fun triggerUrgentHapticPulse() {
        try {
            val vibrator = getVibrator()
            if (vibrator != null && vibrator.hasVibrator()) {
                val pattern = longArrayOf(0, 150, 80, 150, 80, 250)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(pattern, -1)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(pattern, -1)
                }
            }
        } catch (_: Exception) {}
    }

    private fun emitEvent(eventName: String, params: Any?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in Event Emitter
    }

    @ReactMethod
    fun startPowerButtonTrigger(promise: Promise) {
        try {
            if (!isPowerReceiverRegistered) {
                val filter = IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_SCREEN_ON)
                }
                reactContext.registerReceiver(powerButtonReceiver, filter)
                isPowerReceiverRegistered = true
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopPowerButtonTrigger(promise: Promise) {
        try {
            if (isPowerReceiverRegistered) {
                reactContext.unregisterReceiver(powerButtonReceiver)
                isPowerReceiverRegistered = false
            }
            powerPressTimes.clear()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Guardian Emergency Access",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Quick lock-screen access to SOS and emergency protection"
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setShowBadge(true)
            }
            val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    @ReactMethod
    fun showEmergencyQuickNotification(title: String, message: String, promise: Promise) {
        try {
            createNotificationChannel()

            val packageManager = reactContext.packageManager
            val launchIntent = packageManager.getLaunchIntentForPackage(reactContext.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                0,
                launchIntent,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
            )

            val builder = NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(if (title.isNotEmpty()) title else "🛡️ Guardian Emergency Shield")
                .setContentText(if (message.isNotEmpty()) message else "Lock-screen quick access • Tap to open SOS")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setAutoCancel(false)

            val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.notify(NOTIFICATION_ID, builder.build())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun hideEmergencyQuickNotification(promise: Promise) {
        try {
            val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(NOTIFICATION_ID)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
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
            val intent = Intent(Intent.ACTION_SENDTO, uri).apply {
                putExtra("sms_body", message)
                putExtra(Intent.EXTRA_TEXT, message)
                putExtra("android.intent.extra.TEXT", message)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
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
