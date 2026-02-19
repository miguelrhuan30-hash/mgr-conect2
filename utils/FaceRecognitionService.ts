import * as faceapi from 'face-api.js';

/**
 * Service singleton responsible for Facial Biometrics operations.
 * Uses face-api.js (TensorFlow.js) to detect, extract and compare facial features.
 */
class FaceRecognitionService {
  private modelsLoaded = false;
  private loadPromise: Promise<void> | null = null;
  
  // Path to models in the public folder
  private readonly MODEL_URL = '/models';
  
  // Security Thresholds
  private readonly MATCH_THRESHOLD = 0.45; // Stricter than default (0.6) for security
  private readonly DETECTION_CONFIDENCE = 0.5;

  /**
   * Loads the necessary neural network models.
   * Implements Singleton pattern to prevent multiple loads.
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;
    
    // If a loading request is already in progress, return that promise
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        console.log("[FaceBiometrics] Carregando modelos neurais...");
        
        await Promise.all([
          // SSD MobileNet V1: Slower but much more accurate than TinyFace
          faceapi.nets.ssdMobilenetv1.loadFromUri(this.MODEL_URL),
          // 68 Point Landmark: Essential for face alignment
          faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
          // Recognition Net: Generates the 128-float descriptor
          faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL)
        ]);

        this.modelsLoaded = true;
        console.log("[FaceBiometrics] Modelos carregados com sucesso.");
      } catch (error) {
        console.error("[FaceBiometrics] Erro Crítico ao carregar modelos:", error);
        this.loadPromise = null; // Reset promise to allow retry
        throw new Error("Falha ao inicializar sistema de biometria. Verifique conexao ou arquivos de modelo.");
      }
    })();

    return this.loadPromise;
  }

  /**
   * Detects a single face and extracts its unique descriptor.
   * @param image HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
   * @returns Float32Array (The "Face Signature") or null if no face found.
   */
  async extractFaceDescriptor(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> {
    if (!this.modelsLoaded) await this.loadModels();

    // Check for valid dimensions to avoid TFJS errors
    if (image instanceof HTMLVideoElement) {
        if (image.readyState < 2 || image.videoWidth === 0 || image.videoHeight === 0) return null;
    }

    try {
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
      console.warn("[FaceBiometrics] Erro durante detecção:", error);
      return null;
    }
  }

  /**
   * Compares two face descriptors using Euclidean Distance.
   * @param descriptor1 Reference face (stored)
   * @param descriptor2 Live face (camera)
   * @returns number (Euclidean distance)
   */
  compareFaces(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]): number {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }

  /**
   * Determines if two faces belong to the same person based on security threshold.
   * @param distance Result from compareFaces
   * @returns boolean
   */
  isMatch(distance: number): boolean {
    return distance < this.MATCH_THRESHOLD;
  }

  // --- HELPERS FOR FIRESTORE STORAGE ---

  /**
   * Helper: Converts Float32Array descriptor to JSON string for Firestore storage.
   */
  descriptorToString(descriptor: Float32Array): string {
    return JSON.stringify(Array.from(descriptor));
  }

  /**
   * Helper: Converts JSON string back to Float32Array for comparison.
   */
  stringToDescriptor(jsonString: string): Float32Array {
    try {
      const parsed = JSON.parse(jsonString);
      return new Float32Array(parsed);
    } catch (e) {
      console.error("Invalid descriptor format", e);
      return new Float32Array([]);
    }
  }
}

export const faceService = new FaceRecognitionService();