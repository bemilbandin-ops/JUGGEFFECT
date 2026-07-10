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
  invertColors: boolean = false,
  enableLightTracking: boolean = false,
  lightThreshold: number = 200,
  edgeAntiAliasing: number = 0
) {
  const len = currData.data.length;
  const c = currData.data;
  const o = outputData.data;

  // We learn foreground objects 10x slower so they don't fade into the background instantly
  const fgRate = bgLearningRate * 0.1;

  for (let i = 0; i < len; i += 4) {
    // RGB sum difference
    const diff = Math.abs(c[i] - bgData[i]) + Math.abs(c[i+1] - bgData[i+1]) + Math.abs(c[i+2] - bgData[i+2]);
    
    let isForeground = false;
    if (diff > threshold) {
      isForeground = true;
      // Only check brightness if the pixel is already moving!
      if (enableLightTracking) {
        const r = c[i], g = c[i+1], b = c[i+2];
        const brightness = r > g ? (r > b ? r : b) : (g > b ? g : b); // Inline Math.max for speed
        if (brightness <= lightThreshold) {
          isForeground = false;
        }
      }
    }

    if (isForeground) {
      // Calculate anti-aliased alpha
      let alpha = 255;
      if (edgeAntiAliasing > 0) {
        if (diff < threshold + edgeAntiAliasing) {
           alpha = Math.floor(((diff - threshold) / edgeAntiAliasing) * 255);
        }
      }

      // Foreground: copy original pixel, set computed alpha
      o[i] = invertColors ? 255 - c[i] : c[i];
      o[i+1] = invertColors ? 255 - c[i+1] : c[i+1];
      o[i+2] = invertColors ? 255 - c[i+2] : c[i+2];
      o[i+3] = alpha;
      
      // Update background slowly
      bgData[i] += (c[i] - bgData[i]) * fgRate;
      bgData[i+1] += (c[i+1] - bgData[i+1]) * fgRate;
      bgData[i+2] += (c[i+2] - bgData[i+2]) * fgRate;
    } else {
      // Background: transparent
      o[i] = 0;
      o[i+1] = 0;
      o[i+2] = 0;
      o[i+3] = 0; 
      
      // Update background normally
      bgData[i] += (c[i] - bgData[i]) * bgLearningRate;
      bgData[i+1] += (c[i+1] - bgData[i+1]) * bgLearningRate;
      bgData[i+2] += (c[i+2] - bgData[i+2]) * bgLearningRate;
    }
  }
}
