package com.mgr.fieldapp;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * LocationPlugin — bridge entre JavaScript e LocationForegroundService.
 *
 * Uso no JS (via FieldApp):
 *   import { Plugins } from '@capacitor/core';
 *   const { LocationPlugin } = Plugins;
 *   await LocationPlugin.startTracking({ userId, userName, idToken });
 *   await LocationPlugin.stopTracking();
 */
@CapacitorPlugin(name = "LocationPlugin")
public class LocationPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        String userId   = call.getString("userId",   "");
        String userName = call.getString("userName", "Técnico");
        String idToken  = call.getString("idToken",  "");

        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        intent.putExtra(LocationForegroundService.EXTRA_USER_ID,   userId);
        intent.putExtra(LocationForegroundService.EXTRA_USER_NAME, userName);
        intent.putExtra(LocationForegroundService.EXTRA_ID_TOKEN,  idToken);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
