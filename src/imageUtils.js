const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const MAX_SIDE = 280;
const JPEG_QUALITY = 0.88;

export function isSafeDataImageUrl(s) {
  return typeof s === 'string' && s.startsWith('data:image/') && s.length < 2_500_000;
}

export function fileToResizedJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Archivo no válido'));
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      reject(new Error('La imagen es demasiado grande (máx. 6 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('No se pudo leer la imagen'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w < 1 || h < 1) {
          reject(new Error('Imagen inválida'));
          return;
        }
        if (w > MAX_SIDE || h > MAX_SIDE) {
          const r = Math.min(MAX_SIDE / w, MAX_SIDE / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch {
          reject(new Error('No se pudo procesar la imagen'));
        }
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}
