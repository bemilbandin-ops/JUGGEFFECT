export function drawCloneStampPreview(
  ctx: CanvasRenderingContext2D,
  mouseX: number,
  mouseY: number,
  brushSize: number,
  offsetX: number,
  offsetY: number
): void {
  const sourceX = mouseX + offsetX;
  const sourceY = mouseY + offsetY;

  ctx.save();

  // 1. Draw connecting dashed line
  ctx.beginPath();
  ctx.moveTo(mouseX, mouseY);
  ctx.lineTo(sourceX, sourceY);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();

  // 2. Draw destination brush circle (where details will be painted)
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, brushSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();

  // Add a small center dot
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();

  // 3. Draw source clone circle (where details are copied from)
  ctx.beginPath();
  ctx.arc(sourceX, sourceY, brushSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 2]);
  ctx.stroke();

  // Add a small center dot
  ctx.beginPath();
  ctx.arc(sourceX, sourceY, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.restore();
}
