package com.mgr.fieldapp;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LocationForegroundService extends Service {

    private static final String TAG           = "MGR_LocationService";
    private static final String CHANNEL_ID    = "mgr_location_channel";
    private static final int    NOTIF_ID      = 1001;
    private static final long   INTERVAL_MS   = 3 * 60 * 1000L;
    private static final long   FAST_INTERVAL = 60 * 1000L;

    private static final String FIRESTORE_PROJECT = "mgr-conect2";
    private static final String FIRESTORE_BASE    =
        "https://firestore.googleapis.com/v1/projects/" + FIRESTORE_PROJECT +
        "/databases/(default)/documents/";

    public static final String EXTRA_USER_ID   = "userId";
    public static final String EXTRA_USER_NAME = "userName";
    public static final String EXTRA_ID_TOKEN  = "idToken";

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private ExecutorService executor;

    private String userId   = "";
    private String userName = "";
    private String idToken  = "";

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            executor = Executors.newSingleThreadExecutor();
            createNotificationChannel();
        } catch (Exception e) {
            Log.e(TAG, "onCreate error: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (intent != null) {
                userId   = intent.getStringExtra(EXTRA_USER_ID)   != null ? intent.getStringExtra(EXTRA_USER_ID)   : "";
                userName = intent.getStringExtra(EXTRA_USER_NAME) != null ? intent.getStringExtra(EXTRA_USER_NAME) : "Técnico";
                idToken  = intent.getStringExtra(EXTRA_ID_TOKEN)  != null ? intent.getStringExtra(EXTRA_ID_TOKEN)  : "";
            }

            // Verifica permissão de localização antes de qualquer coisa
            boolean hasPermission =
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;

            if (!hasPermission) {
                Log.w(TAG, "Sem permissão de localização — serviço não iniciado.");
                stopSelf();
                return START_NOT_STICKY;
            }

            startForeground(NOTIF_ID, buildNotification());
            startLocationUpdates();
            Log.i(TAG, "Serviço iniciado para userId=" + userId);

        } catch (Exception e) {
            Log.e(TAG, "onStartCommand error: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            stopLocationUpdates();
            if (executor != null) executor.shutdownNow();
        } catch (Exception e) {
            Log.e(TAG, "onDestroy error: " + e.getMessage());
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void startLocationUpdates() {
        try {
            fusedClient = LocationServices.getFusedLocationProviderClient(this);

            LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
                .setMinUpdateIntervalMillis(FAST_INTERVAL)
                .setWaitForAccurateLocation(false)
                .build();

            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult result) {
                    if (result == null) return;
                    Location loc = result.getLastLocation();
                    if (loc != null && executor != null && !executor.isShutdown()) {
                        executor.submit(() -> sendToFirestore(loc));
                    }
                }
            };

            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());

        } catch (SecurityException e) {
            Log.e(TAG, "Permissão negada: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "startLocationUpdates error: " + e.getMessage());
        }
    }

    private void stopLocationUpdates() {
        try {
            if (fusedClient != null && locationCallback != null) {
                fusedClient.removeLocationUpdates(locationCallback);
            }
        } catch (Exception e) {
            Log.e(TAG, "stopLocationUpdates error: " + e.getMessage());
        }
    }

    private void sendToFirestore(Location loc) {
        try {
            long now = System.currentTimeMillis();
            writeDocument("localizacoes_atual/" + userId, loc, now);
            writeDocument("localizacoes_historico/" + userId + "_" + now, loc, now);
        } catch (Exception e) {
            Log.e(TAG, "sendToFirestore error: " + e.getMessage());
        }
    }

    private void writeDocument(String path, Location loc, long nowMs) throws Exception {
        JSONObject body = new JSONObject();
        JSONObject fields = new JSONObject();
        fields.put("userId",    new JSONObject().put("stringValue", userId));
        fields.put("userName",  new JSONObject().put("stringValue", userName));
        fields.put("lat",       new JSONObject().put("doubleValue", loc.getLatitude()));
        fields.put("lng",       new JSONObject().put("doubleValue", loc.getLongitude()));
        fields.put("accuracy",  new JSONObject().put("doubleValue", loc.getAccuracy()));
        fields.put("speed",     new JSONObject().put("doubleValue", loc.getSpeed()));
        fields.put("source",    new JSONObject().put("stringValue", "foreground_service"));
        fields.put("timestamp", new JSONObject().put("integerValue", String.valueOf(nowMs)));
        body.put("fields", fields);

        URL url = new URL(FIRESTORE_BASE + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("PATCH");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        if (!idToken.isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + idToken);
        }
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.toString().getBytes("UTF-8"));
        }

        int code = conn.getResponseCode();
        if (code >= 200 && code < 300) {
            Log.d(TAG, "OK: " + loc.getLatitude() + "," + loc.getLongitude());
        } else {
            Log.w(TAG, "Firestore HTTP " + code);
        }
        conn.disconnect();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "MGR Campo — Rastreio", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Rastreio de localização em tempo real.");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(this, 0, openApp, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MGR Campo — Ativo")
            .setContentText("Rastreio de localização em andamento")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build();
    }
}
