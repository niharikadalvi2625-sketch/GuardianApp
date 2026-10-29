package com.guardianapp

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class GuardianLocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val fusedLocationClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(reactContext)
    }

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
    fun openLocationSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } catch (err: Exception) {
                promise.reject("OPEN_SETTINGS_ERROR", err.message)
            }
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        if (!hasPermission()) {
            promise.reject("PERMISSION_DENIED", "Location permission is not granted")
            return
        }

        val isResolved = AtomicBoolean(false)
        val mainHandler = Handler(Looper.getMainLooper())
        val cts = CancellationTokenSource()

        // 1. Try Google Play Services Fused Location Provider (High Accuracy: GPS + Wi-Fi + Cell Towers)
        try {
            fusedLocationClient.lastLocation
                .addOnSuccessListener { lastLoc: Location? ->
                    val now = System.currentTimeMillis()
                    // If cached lastLocation is fresh (< 2 mins) and accurate, use it immediately
                    if (lastLoc != null && (now - lastLoc.time) < 120_000 && lastLoc.accuracy < 100f) {
                        if (isResolved.compareAndSet(false, true)) {
                            cts.cancel()
                            resolveWithLocation(lastLoc, promise)
                            return@addOnSuccessListener
                        }
                    }

                    // Request fresh high-accuracy location fix
                    fusedLocationClient.getCurrentLocation(
                        Priority.PRIORITY_HIGH_ACCURACY,
                        cts.token
                    ).addOnSuccessListener { freshLoc: Location? ->
                        if (freshLoc != null) {
                            if (isResolved.compareAndSet(false, true)) {
                                resolveWithLocation(freshLoc, promise)
                            }
                        } else if (lastLoc != null) {
                            if (isResolved.compareAndSet(false, true)) {
                                resolveWithLocation(lastLoc, promise)
                            }
                        } else {
                            fallbackToLocationManager(promise, isResolved)
                        }
                    }.addOnFailureListener {
                        if (lastLoc != null) {
                            if (isResolved.compareAndSet(false, true)) {
                                resolveWithLocation(lastLoc, promise)
                            }
                        } else {
                            fallbackToLocationManager(promise, isResolved)
                        }
                    }
                }
                .addOnFailureListener {
                    fallbackToLocationManager(promise, isResolved)
                }

            // Timeout safety for Fused Location (5.5 seconds)
            mainHandler.postDelayed({
                if (!isResolved.get()) {
                    cts.cancel()
                    fallbackToLocationManager(promise, isResolved)
                }
            }, 5500)

        } catch (e: Exception) {
            fallbackToLocationManager(promise, isResolved)
        }
    }

    @SuppressLint("MissingPermission")
    private fun fallbackToLocationManager(promise: Promise, isResolved: AtomicBoolean) {
        if (isResolved.get()) return

        val lm = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (lm == null) {
            if (isResolved.compareAndSet(false, true)) {
                promise.reject("NO_LOCATION_MANAGER", "LocationManager service not available")
            }
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
        if (bestLocation != null && (now - bestLocation.time) < 180_000 && bestLocation.accuracy < 150f) {
            if (isResolved.compareAndSet(false, true)) {
                resolveWithLocation(bestLocation, promise)
                return
            }
        }

        val mainHandler = Handler(Looper.getMainLooper())
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (isResolved.compareAndSet(false, true)) {
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
            if (isResolved.compareAndSet(false, true)) {
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
        mainHandler.postDelayed(timeoutRunnable, 5000)

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

                if (!requested) {
                    mainHandler.removeCallbacks(timeoutRunnable)
                    if (bestLocation != null) {
                        if (isResolved.compareAndSet(false, true)) {
                            resolveWithLocation(bestLocation, promise)
                        }
                    } else {
                        if (isResolved.compareAndSet(false, true)) {
                            promise.reject("PROVIDERS_DISABLED", "Device location providers are disabled")
                        }
                    }
                }
            } catch (e: SecurityException) {
                mainHandler.removeCallbacks(timeoutRunnable)
                if (bestLocation != null) {
                    if (isResolved.compareAndSet(false, true)) {
                        resolveWithLocation(bestLocation, promise)
                    }
                } else {
                    if (isResolved.compareAndSet(false, true)) {
                        promise.reject("SECURITY_EXCEPTION", e.message)
                    }
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
                if (Geocoder.isPresent()) {
                    val geocoder = Geocoder(reactContext, Locale.getDefault())
                    val addresses: List<Address>?

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val latch = CountDownLatch(1)
                        var resultList: List<Address>? = null
                        geocoder.getFromLocation(
                            location.latitude,
                            location.longitude,
                            1
                        ) { addrs ->
                            resultList = addrs
                            latch.countDown()
                        }
                        latch.await(2500, TimeUnit.MILLISECONDS)
                        addresses = resultList
                    } else {
                        @Suppress("DEPRECATION")
                        addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                    }

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
                }
            } catch (e: Exception) {
                // Ignore geocoder lookup error, coords are already in map
            }
            promise.resolve(map)
        }.start()
    }
}
