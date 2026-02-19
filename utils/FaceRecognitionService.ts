import * as faceapi from 'face-api.js';

/**
 * Service singleton responsible for Facial Biometrics operations.
 * Uses face-api.js (TensorFlow.js) to detect, extract and compare facial features.
 * 
 * ESTRATÉGIA DE BLINDAGEM (FAILOVER):
 * 1. Tenta carregar modelos da pasta local '/models'.
 * 2. Se falhar, tenta carregar da CDN oficial do face-api.js.
 * 3. Garante que o sistema só falhe se ambas as fontes estiverem inacessíveis.
 */
class FaceRecognitionService {
  private modelsLoaded = false;
  private loadPromise: Promise<void> | null = null;
  
  // 1. Definição de URLs
  private readonly LOCAL_URL = '/models';
  private readonly CDN_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
  
  // Configurações de Precisão
  private readonly MATCH_THRESHOLD = 0.45; // Mais estrito que o padrão (0.6) para segurança
  private readonly DETECTION_CONFIDENCE = 0.5;

  /**
   * Helper interno para carregar o conjunto de modelos de uma URL específica.
   */
  private async _loadModelsFromUrl(url: string): Promise<void> {
    await Promise.all([
      // SSD MobileNet V1: Mais preciso que o TinyFace, ideal para reconhecimento facial
      faceapi.nets.ssdMobilenetv1.loadFromUri(url),
      // 68 Point Landmark: Essencial para alinhamento do rosto
      faceapi.nets.faceLandmark68Net.loadFromUri(url),
      // Recognition Net: Gera o descritor facial (assinatura biométrica)
      faceapi.nets.faceRecognitionNet.loadFromUri(url)
    ]);
  }

  /**
   * Carrega os modelos neurais com estratégia de redundância.
   * Singleton: Evita múltiplos carregamentos simultâneos.
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;
    
    // Evita race conditions retornando a promise existente se já estiver carregando
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // TENTATIVA 1: Carregamento Local
        console.log(`[FaceBiometrics] Tentando carregar modelos locais de: ${this.LOCAL_URL}`);
        await this._loadModelsFromUrl(this.LOCAL_URL);
        console.log("[FaceBiometrics] Sucesso: Modelos locais carregados.");
      
      } catch (localError) {
        // FAILOVER: Captura o erro local e tenta CDN
        console.warn("[FaceBiometrics] Falha ao carregar modelos locais. Tentando CDN...", localError);
        
        try {
          // TENTATIVA 2: Carregamento via CDN
          console.log(`[FaceBiometrics] Tentando carregar modelos da CDN: ${this.CDN_URL}`);
          await this._loadModelsFromUrl(this.CDN_URL);
          console.log("[FaceBiometrics] Sucesso: Modelos carregados via CDN.");
        
        } catch (cdnError) {
          // ERRO FATAL: Ambas as tentativas falharam
          console.error("[FaceBiometrics] Erro Crítico: Falha total no carregamento (Local e CDN).", cdnError);
          this.loadPromise = null; // Reseta para permitir nova tentativa futura
          throw new Error("Falha ao inicializar sistema de biometria. Verifique sua conexão.");
        }
      }

      this.modelsLoaded = true;
    })();

    return this.loadPromise;
  }

  /**
   * Detecta um rosto na imagem e extrai seu descritor biométrico.
   * @param image Elemento de vídeo, imagem ou canvas.
   * @returns Float32Array (Assinatura do rosto) ou null se não encontrar.
   */
  async extractFaceDescriptor(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> {
    // Garante que os modelos estejam carregados
    if (!this.modelsLoaded) await this.loadModels();

    // Verificações de segurança para evitar erros do TensorFlow
    if (image instanceof HTMLVideoElement) {
        if (image.readyState < 2 || image.videoWidth === 0 || image.videoHeight === 0) return null;
    }

    try {
      // Detecção usando SSD MobileNet v1
      const detection = await faceapi.detectSingleFace(
        image, 
        new faceapi.SsdMobilenetv1Options({ minConfidence: this.DETECTION_CONFIDENCE })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      return detection.descriptor;
    } catch (error) {
      console.warn("[FaceBiometrics] Erro durante processamento da imagem:", error);
      return null;
    }
  }

  /**
   * Compara dois descritores faciais usando Distância Euclidiana.
   * @param descriptor1 Rosto de referência (banco de dados)
   * @param descriptor2 Rosto capturado (câmera)
   * @returns number (Distância - quanto menor, mais parecido)
   */
  compareFaces(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]): number {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }

  /**
   * Verifica se a distância entre dois rostos é aceitável para considerar a mesma pessoa.
   */
  isMatch(distance: number): boolean {
    return distance < this.MATCH_THRESHOLD;
  }

  // --- Helpers de Serialização para Firestore ---

  descriptorToString(descriptor: Float32Array): string {
    return JSON.stringify(Array.from(descriptor));
  }

  stringToDescriptor(jsonString: string): Float32Array {
    try {
      const parsed = JSON.parse(jsonString);
      return new Float32Array(parsed);
    } catch (e) {
      console.error("[FaceBiometrics] Erro ao converter descritor salvo:", e);
      return new Float32Array([]);
    }
  }
}

export const faceService = new FaceRecognitionService();