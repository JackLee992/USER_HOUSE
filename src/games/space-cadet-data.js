const SIGNATURE = 'PARTOUT(4.0)RESOURCE';
const TABLE_WIDTHS = [600, 752, 960];
const MAX_DECODED_BYTES = 256 * 1024 * 1024;

// Validate the packed types consumed by partman/GroupData before loading a local
// file into the legacy engine. This is an integrity check, not a sandbox for
// arbitrary game scripts; physics attributes still belong to the selected table.
export function validateCadetData(buffer, filename) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bad = () => { throw Error('DAT 不是完整的 Space Cadet 球台资源，请重新选择。'); };
  const text = (offset, size) => {
    const end = bytes.subarray(offset, offset + size).indexOf(0);
    if (end < 0) bad();
    return new TextDecoder().decode(bytes.subarray(offset, offset + end));
  };
  let decodedBytes = 0;
  const allocate = size => {
    decodedBytes += size;
    if (!Number.isSafeInteger(size) || size < 0 || decodedBytes > MAX_DECODED_BYTES) bad();
  };
  if (bytes.length < 183 || bytes.length > 32 * 1024 * 1024 || text(0, 21) !== SIGNATURE) bad();
  text(21, 50); text(71, 100);
  const count = view.getUint16(175, true), groups = [], named = new Map();
  let offset = 183 + view.getUint16(181, true);
  // Full Tilt has one extra resolution byte in each depth-map header. Without a
  // filename, its odd field length distinguishes it from the original layout.
  let fullTilt = filename ? /^cadet\.dat$/i.test(filename) : undefined;
  if (!count || count > 10000 || offset > bytes.length) bad();

  function bitmap(start, size) {
    if (size < 14) bad();
    const resolution = bytes[start], width = view.getInt16(start + 1, true), height = view.getInt16(start + 3, true);
    const length = view.getInt32(start + 9, true), flags = bytes[start + 13];
    if (resolution > 2 || width <= 0 || height <= 0 || length !== size - 14) bad();
    const pixels = width * height, spliced = !!(flags & 4);
    allocate(length + pixels * (spliced ? 12 : 4));
    if (!spliced) {
      if (length !== Math.ceil(width / 4) * 4 * height) bad();
    } else {
      // Spliced sprites encode signed skip, unsigned count, then count triples
      // (uint16 depth, uint8 palette index), ending at a negative signed skip.
      let p = start + 14, destination = 0;
      const end = start + size;
      for (;;) {
        if (p + 2 > end) bad();
        let skip = view.getInt16(p, true); p += 2;
        if (skip < 0) break;
        if (skip > width) skip += width - TABLE_WIDTHS[resolution];
        if (skip < 0 || p + 2 > end) bad();
        const run = view.getUint16(p, true); p += 2;
        destination += skip;
        if (destination + run > pixels || p + run * 3 > end) bad();
        destination += run; p += run * 3;
      }
    }
    return {resolution, width, height, spliced, x:view.getInt16(start + 5, true), y:view.getInt16(start + 7, true)};
  }

  function depthMap(start, size) {
    if (fullTilt === undefined) fullTilt = !!(size % 2);
    if (fullTilt && (size < 15 || bytes[start] > 2)) bad();
    const resolution = fullTilt ? bytes[start++] : 0, prefix = fullTilt ? 1 : 0;
    if (size < 14 + prefix) bad();
    const width = view.getInt16(start, true), height = view.getInt16(start + 2, true), stride = view.getInt16(start + 4, true);
    const length = size - 14 - prefix;
    if (width < 0 || height < 0 || stride < width || length % 2) bad();
    // Original 3D Pinball includes two unused, zero-header depth maps. The
    // upstream loader skips their payload, so keep accepting those placeholders.
    const placeholder = width === 0 && height === 0 && stride === 0;
    if (!placeholder && (width === 0 || height === 0 || length !== stride * height * 2)) bad();
    allocate(stride * height * 2);
    return {resolution, width, height, placeholder};
  }

  for (let g = 0; g < count; g++) {
    if (offset >= bytes.length) bad();
    const entries = bytes[offset++], group = {fields:[], bitmaps:new Map(), depths:new Map()};
    // Native _lread_char returns a signed char before reserve/iteration.
    if (entries > 127) bad();
    let previous = -1;
    for (let e = 0; e < entries; e++) {
      if (offset >= bytes.length) bad();
      const kind = bytes[offset++];
      if (kind > 12 || kind < previous) bad();
      previous = kind;
      let size = 2;
      if (kind !== 0 && kind !== 2) {
        if (offset + 4 > bytes.length) bad();
        size = view.getInt32(offset, true); offset += 4;
      }
      if (size < 0 || offset + size > bytes.length) bad();
      const field = {kind, size, offset}; group.fields.push(field);
      if (kind === 1) {
        const bmp = bitmap(offset, size);
        if (group.bitmaps.has(bmp.resolution)) bad();
        group.bitmaps.set(bmp.resolution, bmp);
        if (bmp.spliced) group.depths.set(bmp.resolution, bmp);
      } else if (kind === 12) {
        const depth = depthMap(offset, size);
        if (group.depths.has(depth.resolution)) bad();
        group.depths.set(depth.resolution, depth);
      } else if (kind === 3 || kind === 9) {
        const value = text(offset, size);
        if (kind === 3) named.set(value, group);
      } else if (kind === 5) {
        if (size < 1024 || size % 4) bad();
      } else if (kind === 10) {
        if (size < 2 || size % 2) bad();
      } else if (kind === 11) {
        if (size < 4 || size % 4) bad();
        for (let p = offset; p < offset + size; p += 4) if (!Number.isFinite(view.getFloat32(p, true))) bad();
      }
      offset += size;
    }
    for (const [resolution, bmp] of group.bitmaps) {
      const depth = group.depths.get(resolution);
      if (depth && !depth.placeholder && (depth.width !== bmp.width || depth.height !== bmp.height)) bad();
    }
    groups.push(group);
  }
  if (offset !== bytes.length) bad();
  const field = (group, kind) => group?.fields.find(f => f.kind === kind);
  const table = named.get('table'), background = named.get('background'), camera = named.get('camera_info');
  const bmp = table?.bitmaps.get(0), bg = background?.bitmaps.get(0);
  if (!bmp || !table.depths.get(0) || !bg || !field(background, 5) || (field(camera, 11)?.size || 0) < 60) bad();
  // pb::init copies this bitmap into the fixed-width framebuffer without clipping.
  if (bmp.width > TABLE_WIDTHS[0] || bg.x < 0 || bg.y < 0 || bg.x + bg.width > TABLE_WIDTHS[0] || bg.y + bg.height > Math.max(416, bmp.height)) bad();
  const projection = table.fields.find(f => f.kind === 11 && Math.floor(view.getFloat32(f.offset, true)) === 700);
  if (!projection || projection.size < 12) bad();
  const objects = named.get('table_objects')?.fields.find(f => f.kind === 10 && view.getInt16(f.offset, true) === 1025);
  if (!objects || objects.size < 6 || (objects.size - 2) % 4) bad();
  for (let p = objects.offset + 4; p < objects.offset + objects.size; p += 4) {
    const index = view.getInt16(p, true);
    if (index < 0 || index >= groups.length) bad();
  }
  return buffer;
}
