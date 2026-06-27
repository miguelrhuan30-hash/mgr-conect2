package com.mgr.fieldapp;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registra plugin nativo de rastreio de localização
        registerPlugin(LocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
