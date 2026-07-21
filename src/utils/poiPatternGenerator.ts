import { TrackingSettings } from '../types';

export function updatePoiPattern(
  canvas: HTMLCanvasElement,
  currentSettings: TrackingSettings,
  customImageElement: HTMLImageElement | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const type = currentSettings.poiPatternType;

  if (type === 'swedish') {
    canvas.width = 160;
    canvas.height = 100;
    ctx.fillStyle = '#005293';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FECC02';
    ctx.fillRect(0, 40, 160, 20);
    ctx.fillRect(50, 0, 20, 100);
  }
  else if (type === 'youtube') {
    canvas.width = 150;
    canvas.height = 100;
    // Keep background transparent to avoid erasing trails
    ctx.fillStyle = '#FF0000';
    const r = 20;
    const x = 15, y = 15, w = 120, h = 70;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(60, 35);
    ctx.lineTo(60, 65);
    ctx.lineTo(95, 50);
    ctx.closePath();
    ctx.fill();
  }
  else if (type === 'rainbow') {
    canvas.width = 256;
    canvas.height = 64;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.17, '#ff00ff');
    grad.addColorStop(0.33, '#0000ff');
    grad.addColorStop(0.5, '#00ffff');
    grad.addColorStop(0.67, '#00ff00');
    grad.addColorStop(0.83, '#ffff00');
    grad.addColorStop(1, '#ff0000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  else if (type === 'flowers') {
    canvas.width = 300;
    canvas.height = 128;
    // Keep background transparent to avoid erasing trails
    const colors = ['#FF2A85', '#00FFCC', '#FFE600', '#FF7F00', '#9D00FF'];
    for (let c = 0; c < 3; c++) {
      const cx = 50 + c * 100;
      const cy = 64;
      const r = 24;
      ctx.fillStyle = colors[c % colors.length];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  else if (type === 'text') {
    const text = currentSettings.poiText || 'JUGGLE';
    const textColor = currentSettings.poiTextColor || '#ff2a85';
    ctx.font = 'bold 36px sans-serif';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(text).width;
    canvas.width = Math.max(textWidth + 40, 100);
    canvas.height = 64;
    // Keep background transparent to avoid erasing trails
    ctx.fillStyle = textColor;
    ctx.font = 'bold 36px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  else if (type === 'custom') {
    if (customImageElement && customImageElement.complete && customImageElement.naturalWidth > 0) {
      canvas.width = customImageElement.naturalWidth;
      canvas.height = customImageElement.naturalHeight;
      ctx.drawImage(customImageElement, 0, 0);
    } else {
      canvas.width = 100;
      canvas.height = 64;
      ctx.fillStyle = '#222222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Image Uploaded', 50, 32);
    }
  }
  else if (type === 'spiral') {
    // Creates a repeating spiral/helix pattern that produces the feathered look from reference images
    canvas.width = 360;
    canvas.height = 72;
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normX = x / canvas.width;
        const normY = y / canvas.height;
        const angle = normX * Math.PI * 6; // 3 full spirals across the width
        const wave = Math.sin(angle + normY * Math.PI * 4) * 0.5 + 0.5;
        const h = (normX * 240 + 200) % 360; // Cyan to magenta hue sweep
        const s = 85 + wave * 15;
        const l = 20 + wave * 55;
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  else if (type === 'chevron') {
    // Creates repeating chevron/zigzag geometry — produces triangular patterns when spun
    canvas.width = 256;
    canvas.height = 80;
    const colors = ['#FF2A85', '#00FFCC', '#3B82F6', '#A855F7'];
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normY = y / canvas.height;
        const phase = (x / 32) * Math.PI * 2;
        const zigzag = Math.abs(((normY * 4 + Math.sin(phase) * 0.3) % 1) * 2 - 1);
        const band = Math.floor(normY * 4) % colors.length;
        if (zigzag > 0.15) {
          ctx.fillStyle = colors[band];
          ctx.globalAlpha = 0.3 + zigzag * 0.7;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
  else if (type === 'mandala') {
    // Creates concentric hexagonal/circular patterns — produces the mandala look from reference image 3
    canvas.width = 360;
    canvas.height = 80;
    const palette = ['#FF0040', '#00FF80', '#FFE600', '#00BFFF', '#FF6600', '#FFFFFF'];
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const normX = x / canvas.width;
        const normY = y / canvas.height;
        const ring = Math.floor((normY * 5 + Math.sin(normX * Math.PI * 12) * 0.15) % palette.length);
        const edgeFade = 1 - Math.abs(Math.sin(normX * Math.PI * 12 + normY * Math.PI * 6)) * 0.3;
        if (edgeFade > 0.4) {
          ctx.fillStyle = palette[ring];
          ctx.globalAlpha = edgeFade;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
