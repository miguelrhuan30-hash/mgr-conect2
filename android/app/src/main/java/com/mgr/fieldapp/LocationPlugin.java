package com.mgr.fieldapp;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * LocationPlugin — bridge entre JavaScript e LocationForegroundService, e
 * pequenos utilitários nativos que "intent:" via window.location não
 * consegue disparar de dentro da WebView do Capacitor (esse esquema só é
 * interceptado automaticamente no navegador Chrome, não numa WebView
 * genérica embutida — precisa de uma chamada Java real).
 *
 * Uso no JS (via FieldApp):
 *   import { Plugins } from '@capacitor/core';
 *   const { LocationPlugin } = Plugins;
 *   await LocationPlugin.startTracking({ userId, userName, idToken });
 *   await LocationPlugin.stopTracking();
 *   await LocationPlugin.abrirConfiguracoesApp();
 *   await LocationPlugin.instalarApk({ url });
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

    /** Abre a tela "Info do app" (Configurações → Apps → MGR Campo) nativamente. */
    @PluginMethod
    public void abrirConfiguracoesApp(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
        intent.setData(uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Checa uma permissão Android diretamente pelo sistema (ContextCompat),
     * sem passar pela navigator.permissions.query() da WebView — essa API,
     * em WebView embutida, não reflete de forma confiável o estado real da
     * permissão do app (fica presa em "negada" mesmo depois do usuário
     * liberar manualmente nas configurações do Android).
     * permissao: nome completo, ex. "android.permission.RECORD_AUDIO".
     */
    @PluginMethod
    public void verificarPermissaoAndroid(PluginCall call) {
        String permissao = call.getString("permissao", "");
        if (permissao.isEmpty()) {
            call.reject("permissao é obrigatória");
            return;
        }
        int result = ContextCompat.checkSelfPermission(getContext(), permissao);
        JSObject ret = new JSObject();
        ret.put("granted", result == PackageManager.PERMISSION_GRANTED);
        call.resolve(ret);
    }

    /** Abre o instalador nativo do Android pra uma URL de APK, fora da WebView. */
    @PluginMethod
    public void instalarApk(PluginCall call) {
        String url = call.getString("url", "");
        if (url.isEmpty()) {
            call.reject("url é obrigatória");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse(url), "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
