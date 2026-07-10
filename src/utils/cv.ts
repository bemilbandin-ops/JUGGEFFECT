/**
 * High-performance background subtraction for Flow Prop (LED) tracking.
 * Computes difference from a rolling background model, outputs an alpha mask of moving pixels.
 */
export function updateBackgroundAndExtractMotion(
  currData: ImageData,
  bgData: Float32Array,
  outputData: ImageData,
  threshold: number,
  bgLearningRate: number = 0.05,
  invertColors: boolean = false
) {
  const len = currData.data.length;
  const c = currData.data;
  const o = outputData.data;

  // We learn foreground objects 10x slower so they don't fade into the background instantly
  const fgRate = bgLearningRate * 0.1;

  for (let i = 0; i < len; i += 4) {
    // RGB sum difference
    const diff = Math.abs(c[i] - bgData[i]) + Math.abs(c[i+1] - bgData[i+1]) + Math.abs(c[i+2] - bgData[i+2]);
    
    if (diff > threshold) {
      // Foreground: copy original pixel, set alpha to 255
      o[i] = invertColors ? 255 - c[i] : c[i];
      o[i+1] = invertColors ? 255 - c[i+1] : c[i+1];
      o[i+2] = invertColors ? 255 - c[i+2] : c[i+2];
      o[i+3] = 255;
      
      // Update background slowly
      bgData[i] += (c[i] - bgData[i]) * fgRate;
      bgData[i+1] += (c[i+1] - bgData[i+1]) * fgRate;
      bgData[i+2] += (c[i+2] - bgData[i+2]) * fgRate;
    } else {
      // Background: transparent
      o[i+3] = 0; 
      
      // Update background normally
      bgData[i] += (c[i] - bgData[i]) * bgLearningRate;
      bgData[i+1] += (c[i+1] - bgData[i+1]) * bgLearningRate;
      bgData[i+2] += (c[i+2] - bgData[i+2]) * bgLearningRate;
    }
  }
}
