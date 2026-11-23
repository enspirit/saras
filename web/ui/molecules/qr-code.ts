import qrcode from 'qrcode-generator';
import { h } from '../dom.ts';

/** Pixels per module, and the quiet margin a reader needs around the code, in modules. */
const SCALE = 5;
const MARGIN = 4;

/**
 * What a phone's camera reads: `content` as a QR code. Always dark on light, whatever the
 * theme: readers expect it. `label` says what it is to those who cannot see it.
 */
export function QrCode(content: string, label: string): HTMLCanvasElement {
  const code = qrcode(0, 'M');
  code.addData(content);
  code.make();
  const size = code.getModuleCount();
  const side = (size + 2 * MARGIN) * SCALE;
  const canvas = h('canvas', { class: 'qr', width: side, height: side, role: 'img', 'aria-label': label });
  const pen = canvas.getContext('2d');
  if (!pen) return canvas;
  pen.fillStyle = '#ffffff';
  pen.fillRect(0, 0, side, side);
  pen.fillStyle = '#000000';
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (code.isDark(row, col)) pen.fillRect((col + MARGIN) * SCALE, (row + MARGIN) * SCALE, SCALE, SCALE);
  return canvas;
}
