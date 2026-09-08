package com.guardianapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class GuardianLocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "GuardianLocation"
    }

    private fun hasPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    @ReactMethod
    fun isLocationEnabled(promise: Promise) {
        val lm = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (lm == null) {
            promise.resolve(false)
            return
        }
        val isGpsEnabled = try { lm.isProviderEnabled(LocationManager.GPS_PROVIDER) } catch (e: Exception) { false }
        val isNetworkEnabled = try { lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) } catch (e: Exception) { false }
        promise.resolve(isGpsEnabled || isNetworkEnabled)
    }

    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        if (!hasPermission()) {
            promise.reject("PERMISSION_DENIED", "Location permission is not granted")
            return
        }

        val lm = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (lm == null) {
            promise.reject("NO_LOCATION_MANAGER", "LocationManager service not available")
            return
        }

        var bestLocation: Location? = null
        val providers = lm.getProviders(true)
        for (provider in providers) {
            try {
                val l = lm.getLastKnownLocation(provider) ?: continue
                if (bestLocation == null || l.accuracy < bestLocation.accuracy) {
                    bestLocation = l
                }
            } catch (e: SecurityException) {
                // Ignore
            }
        }

        val now = System.currentTimeMillis()
        if (bestLocation != null && (now - bestLocation.time) < 45000 && bestLocation.accuracy < 100f) {
            resolveWithLocation(bestLocation, promise)
            return
        }

        val mainHandler = Handler(Looper.getMainLooper())
        var resolved = false

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (!resolved) {
                    resolved = true
                    try {
                        lm.removeUpdates(this)
                    } catch (e: Exception) {}
                    resolveWithLocation(location, promise)
                }
            }

            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        val timeoutRunnable = Runnable {
            if (!resolved) {
                resolved = true
                try {
                    lm.removeUpdates(listener)
                } catch (e: Exception) {}

                if (bestLocation != null) {
                    resolveWithLocation(bestLocation, promise)
                } else {
                    promise.reject("TIMEOUT", "Could not acquire GPS fix within timeout")
                }
            }
        }
        mainHandler.postDelayed(timeoutRunnable, 7000)

        mainHandler.post {
            try {
                var requested = false
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        0L,
                        0f,
                        listener,
                        Looper.getMainLooper()
                    )
                    requested = true
                }
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        0L,
                        0f,
                        listener,
                        Looper.getMainLooper()
                    )
                    requested = true
                }

                if (!requested && bestLocation != null) {
                    mainHandler.removeCallbacks(timeoutRunnable)
                    resolved = true
                    resolveWithLocation(bestLocation, promise)
                } else if (!requested) {
                    mainHandler.removeCallbacks(timeoutRunnable)
                    resolved = true
                    promise.reject("PROVIDERS_DISABLED", "Device location providers are disabled")
                }
            } catch (e: SecurityException) {
                mainHandler.removeCallbacks(timeoutRunnable)
                if (bestLocation != null) {
                    resolved = true
                    resolveWithLocation(bestLocation, promise)
                } else {
                    resolved = true
                    promise.reject("SECURITY_EXCEPTION", e.message)
                }
            }
        }
    }

    private fun resolveWithLocation(location: Location, promise: Promise) {
        val map = Arguments.createMap()
        map.putDouble("latitude", location.latitude)
        map.putDouble("longitude", location.longitude)
        map.putDouble("accuracy", location.accuracy.toDouble())
        map.putDouble("timestamp", location.time.toDouble())

        Thread {
            try {
                val geocoder = Geocoder(reactContext, Locale.getDefault())
                val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                if (!addresses.isNullOrEmpty()) {
                    val addr = addresses[0]
                    val city = addr.locality ?: addr.subAdminArea ?: addr.adminArea ?: ""
                    val subLocality = addr.subLocality ?: ""
                    val region = addr.adminArea ?: ""
                    val country = addr.countryName ?: ""
                    val addressLine = addr.getAddressLine(0) ?: (if (subLocality.isNotEmpty()) "$subLocality, $city" else city)

                    map.putString("city", city)
                    map.putString("subLocality", subLocality)
                    map.putString("region", region)
                    map.putString("country", country)
                    map.putString("address", addressLine)
                }
            } catch (e: Exception) {
                // Ignore geocoder network error
            }
            promise.resolve(map)
        }.start()
    }
}
