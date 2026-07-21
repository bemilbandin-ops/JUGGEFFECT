export interface BlobPoint {
  x: number;
  y: number;
  angle: number;
  length: number;
  aspectRatio: number;
}

export interface BlobCluster {
  sumX: number;
  sumY: number;
  sumX2: number;
  sumY2: number;
  sumXY: number;
  count: number;
}

export function detectBlobs(maskData: ImageData, maxBlobs: number = 3): BlobPoint[] {
  const width = maskData.width;
  const height = maskData.height;
  const data = maskData.data;
  const clusters: BlobCluster[] = [];
  const step = 6;
  const maxDistance = 60;
  const minPoints = 3;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 50) {
        let joined = false;
        for (let i = 0; i < clusters.length; i++) {
          const c = clusters[i];
          const cx = c.sumX / c.count;
          const cy = c.sumY / c.count;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < maxDistance) {
            c.sumX += x;
            c.sumY += y;
            c.sumX2 += x * x;
            c.sumY2 += y * y;
            c.sumXY += x * y;
            c.count++;
            joined = true;
            break;
          }
        }
        if (!joined && clusters.length < maxBlobs + 5) {
          clusters.push({
            sumX: x,
            sumY: y,
            sumX2: x * x,
            sumY2: y * y,
            sumXY: x * y,
            count: 1
          });
        }
      }
    }
  }

  const validClusters = clusters.filter(c => c.count >= minPoints);

  return validClusters
    .sort((a, b) => b.count - a.count)
    .slice(0, maxBlobs)
    .map(c => {
      const xc = c.sumX / c.count;
      const yc = c.sumY / c.count;
      
      // Central moments for angle and length
      const mu20 = c.sumX2 - c.sumX * xc;
      const mu02 = c.sumY2 - c.sumY * yc;
      const mu11 = c.sumXY - c.sumX * yc;
      
      // PCA Orientation
      const angle = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
      
      // Eigenvalue length estimation
      const varX = mu20 / c.count;
      const varY = mu02 / c.count;
      const covXY = mu11 / c.count;
      const term = Math.sqrt((varX - varY) ** 2 + 4 * covXY ** 2);
      const lambda1 = varX + varY + term;
      const lambda2 = varX + varY - term;
      const aspectRatio = Math.sqrt(lambda1 / Math.max(lambda2, 0.1));
      const length = 2 * Math.sqrt(varX + varY + term) * 2.5;

      return {
        x: xc,
        y: yc,
        angle,
        length: Math.max(length, 25),
        aspectRatio: Math.max(aspectRatio, 1.0)
      };
    });
}
