package com.guardianapp

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class GuardianCameraModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var cameraPromise: Promise? = null
    private var galleryPromise: Promise? = null
    private var currentPhotoPath: String? = null

    companion object {
        private const val REQUEST_IMAGE_CAPTURE = 2001
        private const val REQUEST_PICK_IMAGE = 2002
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "GuardianCamera"
    }

    @ReactMethod
    fun launchCamera(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity does not exist")
            return
        }

        cameraPromise = promise

        try {
            val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            val photoFile = createImageFile()
            currentPhotoPath = photoFile.absolutePath
            val authority = "${reactContext.packageName}.fileprovider"
            val uri = FileProvider.getUriForFile(activity, authority, photoFile)

            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, uri)
            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)

            activity.startActivityForResult(takePictureIntent, REQUEST_IMAGE_CAPTURE)
        } catch (e: Exception) {
            cameraPromise = null
            promise.reject("E_CAMERA_FAILED", "Failed to launch camera: ${e.message}", e)
        }
    }

    @ReactMethod
    fun launchGallery(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity does not exist")
            return
        }

        galleryPromise = promise

        try {
            val pickIntent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            pickIntent.type = "image/*"
            activity.startActivityForResult(pickIntent, REQUEST_PICK_IMAGE)
        } catch (e: Exception) {
            galleryPromise = null
            promise.reject("E_GALLERY_FAILED", "Failed to launch gallery: ${e.message}", e)
        }
    }

    private fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = reactContext.cacheDir
        return File.createTempFile("INCIDENT_${timeStamp}_", ".jpg", storageDir)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_IMAGE_CAPTURE) {
            val p = cameraPromise
            cameraPromise = null
            if (resultCode == Activity.RESULT_OK) {
                val path = currentPhotoPath
                if (path != null && File(path).exists() && File(path).length() > 0) {
                    val map = Arguments.createMap().apply {
                        putString("uri", "file://$path")
                        putString("path", path)
                        putDouble("fileSize", File(path).length().toDouble())
                        putBoolean("isRealCapture", true)
                    }
                    p?.resolve(map)
                } else if (data?.extras?.get("data") != null) {
                    try {
                        val bitmap = data.extras?.get("data") as Bitmap
                        val file = createImageFile()
                        FileOutputStream(file).use { out ->
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
                        }
                        val map = Arguments.createMap().apply {
                            putString("uri", "file://${file.absolutePath}")
                            putString("path", file.absolutePath)
                            putDouble("fileSize", file.length().toDouble())
                            putBoolean("isRealCapture", true)
                        }
                        p?.resolve(map)
                    } catch (e: Exception) {
                        p?.reject("E_SAVE_FAILED", "Failed to save captured thumbnail: ${e.message}")
                    }
                } else {
                    p?.reject("E_EMPTY_IMAGE", "Camera closed without saving photo")
                }
            } else {
                p?.resolve(null)
            }
        } else if (requestCode == REQUEST_PICK_IMAGE) {
            val p = galleryPromise
            galleryPromise = null
            if (resultCode == Activity.RESULT_OK && data?.data != null) {
                try {
                    val selectedUri = data.data!!
                    val inputStream = reactContext.contentResolver.openInputStream(selectedUri)
                    val file = createImageFile()
                    FileOutputStream(file).use { out ->
                        inputStream?.copyTo(out)
                    }
                    val map = Arguments.createMap().apply {
                        putString("uri", "file://${file.absolutePath}")
                        putString("path", file.absolutePath)
                        putDouble("fileSize", file.length().toDouble())
                        putBoolean("isRealCapture", true)
                    }
                    p?.resolve(map)
                } catch (e: Exception) {
                    p?.reject("E_READ_FAILED", "Failed to load selected photo: ${e.message}")
                }
            } else {
                p?.resolve(null)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {}
}

