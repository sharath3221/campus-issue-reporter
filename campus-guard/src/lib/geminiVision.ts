/**
 * ============================================================================
 * Backward Compatibility Layer
 * Re-exports everything from the unified defectVerification engine.
 * Main implementation lives in: src/lib/defectVerification.ts
 * ============================================================================
 */

export * from './defectVerification';
export {
  analyzeImageDefects,
  validateGenuineness,
  detectHumanFaceClientSide,
  extractVisualFeatures,
  PERSON_PATTERNS,
  NO_DEFECT_PATTERNS,
} from './defectVerification';
export type { VisionAnalysisResult, ImagePixelFeatures } from './defectVerification';
