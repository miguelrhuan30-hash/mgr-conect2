import admin from 'firebase-admin';

// Em ambientes do Google Cloud (GCP/Firebase Hosting), o SDK detecta automaticamente 
// as credenciais se estiver configurado para usar ADC (Application Default Credentials)
if (!admin.apps.length) {
    admin.initializeApp({
        // Se estiver rodando localmente, precisará carregar uma chave JSON via serviceAccountKey
        // process.env.GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/chave.json
    });
}

const dbAdmin = admin.firestore();

export { dbAdmin, admin };
