// Display-only composition. The native engine remains the authority for every
// pixel of a ball, flipper, light and depth-tested occluder.
export function nativeFrameLayer(heap, frame, output, transparentBackground) {
  const [pixels, stride, background, backgroundStride, width, height] = frame;
  let changed = 0;
  for (let y = 0, out = 0; y < height; y++) {
    let src = (pixels >>> 2) + y * stride, base = (background >>> 2) + y * backgroundStride;
    for (let x = 0; x < width; x++, src++, base++, out++) {
      const color = heap[src] >>> 0;
      if (transparentBackground && (color & 0xffffff) === (heap[base] & 0xffffff)) output[out] = 0;
      else {
        // Native ARGB8888 uses little-endian BGRA bytes; ImageData needs RGBA.
        output[out] = (0xff000000 | (color & 0xff00) | ((color & 255) << 16) | ((color >>> 16) & 255)) >>> 0;
        changed++;
      }
    }
  }
  return changed;
}

export function displayResolution(width, height, ratio = 1) {
  const scale = Math.min(Math.max(1, ratio), 3, Math.sqrt(2200000 / Math.max(1, width * height)));
  return {width:Math.max(1, Math.round(width * scale)), height:Math.max(1, Math.round(height * scale))};
}

export function createCadetDisplay(canvas, getModule, {useArtwork = true} = {}) {
  const doc = canvas.ownerDocument, win = doc.defaultView;
  const ctx = canvas.getContext('2d', {alpha:false});
  const layer = doc.createElement('canvas'), layerContext = layer.getContext('2d');
  const base = doc.createElement('canvas'), baseContext = base.getContext('2d', {alpha:false});
  const art = new win.Image();
  let imageData = null, words = null, lastFrame = null, disposed = false, sharp = true, baseDirty = true;
  const stats = {mode:'loading',frames:0,changedPixels:0,width:0,height:0,engineWidth:0,engineHeight:0,sourceWidth:0,sourceHeight:0,composeMs:0};
  function resize() {
    const rect = canvas.getBoundingClientRect(), resolution = displayResolution(rect.width,rect.height,win.devicePixelRatio);
    if (canvas.width !== resolution.width || canvas.height !== resolution.height) {
      canvas.width = resolution.width; canvas.height = resolution.height;
    }
    if (base.width !== resolution.width || base.height !== resolution.height) {
      base.width = resolution.width; base.height = resolution.height; baseDirty = true;
    }
    stats.width = canvas.width; stats.height = canvas.height;
    stats.cssWidth = rect.width; stats.cssHeight = rect.height;
  }
  function present(...frame) {
    if (disposed) return;
    const module = getModule(), [pixels,stride,background,backgroundStride,width,height,offsetX = 0,offsetY = 0] = frame;
    if (!module?.HEAPU32 || width <= 0 || height <= 0 || width * height > 4000000 || stride < width || backgroundStride < width) return;
    if ((pixels >>> 2) + stride * height > module.HEAPU32.length || (background >>> 2) + backgroundStride * height > module.HEAPU32.length) return;
    const start = win.performance.now(); lastFrame = frame; resize();
    if (!imageData || layer.width !== width || layer.height !== height) {
      layer.width = width; layer.height = height;
      imageData = layerContext.createImageData(width,height); words = new Uint32Array(imageData.data.buffer);
    }
    const hd = useArtwork && sharp && art.complete && art.naturalWidth > 0;
    stats.changedPixels = nativeFrameLayer(module.HEAPU32,frame,words,hd);
    layerContext.putImageData(imageData,0,0);
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const x = offsetX * canvas.width / width, y = offsetY * canvas.height / height;
    if (hd) {
      if (baseDirty) {
        baseContext.fillStyle = '#000'; baseContext.fillRect(0,0,base.width,base.height);
        baseContext.imageSmoothingEnabled = true; baseContext.imageSmoothingQuality = 'high';
        baseContext.drawImage(art,0,0,base.width,base.height); baseDirty = false;
      }
      ctx.drawImage(base,x,y);
    }
    // A single resampling at the device backing resolution avoids the old
    // 365px -> CSS canvas -> device-pixel double blur on Android.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer,x,y,canvas.width,canvas.height);
    stats.mode = hd ? 'hd' : 'classic'; stats.frames++;
    stats.engineWidth = width; stats.engineHeight = height;
    stats.sourceWidth = hd ? art.naturalWidth : width; stats.sourceHeight = hd ? art.naturalHeight : height;
    stats.composeMs = Math.round((win.performance.now() - start) * 100) / 100;
  }
  const repaint = () => { if (lastFrame && !disposed) present(...lastFrame); };
  art.onload = () => { baseDirty = true; repaint(); };
  if (useArtwork) { art.decoding = 'async'; art.src = new URL('./playfield-hd.png',import.meta.url).href; }
  const observer = new win.ResizeObserver(repaint); observer.observe(canvas);
  win.addEventListener('resize',repaint);
  return {
    present,
    quality(value) { sharp = value !== 'classic'; repaint(); },
    inspection:() => ({...stats}),
    destroy() { disposed = true; observer.disconnect(); win.removeEventListener('resize',repaint); art.onload = null; lastFrame = null; },
  };
}
