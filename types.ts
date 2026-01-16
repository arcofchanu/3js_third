export interface ButterflyParams {
  iter: number; // Number of iterations (length of curve)
  a: number;    // Multiplier for first exp term
  b: number;    // Multiplier for cos term
  c: number;    // Power of sin term
  scale: number; // Overall scale
  color: string;
}

export enum ViewMode {
  Orbit = 'ORBIT',
  AutoRotate = 'AUTO_ROTATE'
}

export interface FingerTip {
  x: number;  // 0 to 1 normalized
  y: number;  // 0 to 1 normalized
  dirX: number; // Direction from palm center (normalized)
  dirY: number; // Direction from palm center (normalized)
}

export interface HandState {
  detected: boolean;
  x: number;      // Pinch point X (0 to 1) - for butterfly
  y: number;      // Pinch point Y (0 to 1) - for butterfly
  palmX: number;  // Palm center X (0 to 1) - for magic circle
  palmY: number;  // Palm center Y (0 to 1) - for magic circle
  pinch: number;  // 0 to 1, mapped to scale
  rotation: number; // Radian rotation of the hand (roll)
  fingerTips: FingerTip[]; // 5 fingertips: thumb, index, middle, ring, pinky
  blast: number;  // 0 to 1, blast/scatter effect (open palm or fist)
}