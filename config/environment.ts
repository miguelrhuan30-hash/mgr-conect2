/**
 * ═══════════════════════════════════════════════════
 * MGR CONECT — CONFIGURAÇÃO DE AMBIENTE
 * ═══════════════════════════════════════════════════
 * 
 * Controla se o sistema roda em PRODUÇÃO ou STAGING.
 * Em staging, todas as coleções Firestore recebem prefixo "dev_"
 * e os uploads de Storage vão para "dev_uploads/".
 * 
 * Variável de controle: VITE_APP_ENV
 *   - "production" (default) → coleções normais
 *   - "staging"              → coleções prefixadas com dev_
 */

export type AppEnvironment = 'production' | 'staging';

// Detecta ambiente via variável de build do Vite
export const APP_ENV: AppEnvironment = 
  (import.meta.env.VITE_APP_ENV as AppEnvironment) || 'production';

export const IS_STAGING: boolean = APP_ENV === 'staging';
export const IS_PRODUCTION: boolean = APP_ENV === 'production';

export const ENV_LABEL: string = IS_STAGING ? 'DESENVOLVIMENTO' : 'PRODUÇÃO';

// Prefixo de coleções Firestore
export const COLLECTION_PREFIX: string = IS_STAGING ? 'dev_' : '';

/**
 * Retorna o nome real da coleção no Firestore.
 * Em produção: retorna o nome original (ex: "users")
 * Em staging:  retorna com prefixo (ex: "dev_users")
 */
export function getCollection(baseName: string): string {
  return `${COLLECTION_PREFIX}${baseName}`;
}

/**
 * Retorna o path correto para uploads no Firebase Storage.
 * Em produção: retorna o path original (ex: "profiles/xyz.jpg")
 * Em staging:  retorna com prefixo (ex: "dev_uploads/profiles/xyz.jpg")
 */
export function getStoragePath(path: string): string {
  return IS_STAGING ? `dev_uploads/${path}` : path;
}

// Log para debug no console
if (IS_STAGING) {
  console.warn(
    '%c🧪 MGR CONECT — AMBIENTE DE DESENVOLVIMENTO',
    'background: #f59e0b; color: #000; font-size: 16px; padding: 8px 16px; border-radius: 4px; font-weight: bold;'
  );
  console.warn('Todas as coleções Firestore usam prefixo "dev_". Dados isolados do sistema principal.');
}
