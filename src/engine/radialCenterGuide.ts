export function drawRadialCenterGuide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, Math.PI * 2);
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy);
  ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
  ctx.setLineDash([4, 4]);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Center of Rotation', cx, cy - 45);
  ctx.restore();
}
