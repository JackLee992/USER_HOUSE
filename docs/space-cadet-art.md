# 球台美术来源

静态球台由 imagegen 重绘，参考用户提供的经典 Space Cadet 截图的配色、塑料与金属质感；几何定位模板来自 CC0 Open Cadet 的 table 位图。生成的高清源图在 `assets/space-cadet/playfield-hd.png`。

引擎仍按原始 365×470 网格合成画面；不是高分辨率实时三维模型。高清源图按该网格重采样为真彩 RGBA，保留模板索引0的黑色孔位，再打包进 .data。固定碰撞面、坡道高度、深度遮挡、灯光和动态精灵来自完整引擎与数据，不由生成图猜测。

最终编码文件 `tools/space-cadet/table.rgba` 为686200字节，供构建脚本原样预载。导入用户本地原版 DAT 时移除这层覆盖，使用所导入素材的球台与精灵。未分发 Microsoft 原版 DAT 或 WAV。

初次生成提示词：

```text
Use case: style-transfer. Asset: production static playfield texture for a faithful classic Space Cadet pinball engine.
Image 1 is the EXACT geometry template to preserve. It is a 365 by 470 pixel portrait bitmap: tapered trapezoid table on black, with rails, a looped launch ramp on the upper left, fuel-bank channels on the upper right, seven black circular holes for separately rendered bumper sprites, central circular rank display, lower triangular slingshots, lower inlanes and outlanes, and no flippers installed.
Image 2 is the user's classic game COLOR / MATERIAL / ART-DIRECTION reference only, not the geometry template; it is cropped. Restore the elaborate, colorful late-1990s pre-rendered 3D arcade look visible there: dark indigo blue marbled galactic playfield, lavender and purple molded ramp plastic, warm ivory chrome rails with orange-red edge trim, red and gold hardware, purple wing-shaped apron illustration, inset triangular yellow direction arrows, small planets and space decals. Polished physical layered plastic and metal, detailed but not noisy, no generic monochrome cyan-neon repaint.
CRITICAL REGISTRATION: preserve Image 1's composition, aspect ratio, outer silhouette, exact positions and dimensions of EVERY wall, ramp, drain, circular hole, target pad, bumper opening, slingshot and lane. This is a drop-in texture whose collision geometry cannot change. Keep ALL black holes entirely black and open, since moving bumpers are rendered separately. The two flippers and ball are separate sprites: do not add any flippers or ball. Keep central circular rings physically at the exact same spot; recolor them as subdued blue/red/yellow indicator sockets rather than a glowing reactor. Add purple decorative apron wings only in the vacant flat lower-center surface, never across rails or holes. Keep black exterior area black. Do not change camera, crop, scale individual objects, add machines, text labels, logos, scores, or new obstacles. Keep static decorative lights unlit: active lights are drawn by the game.
Return one complete texture matching the full 365:470 template aspect, high quality and crisp; the design will be downsampled to engine resolution. This is a game texture, not a screenshot of an app and not a mockup.
```

随后编辑同一生成图：移除下方静态图上误生成的两条挡板形装饰，只保留空的挡板运动区域及平面紫色底纹，不改变球台尺寸、轨道、孔位或其他元素。实际挡板必须由引擎单独绘制并参与碰撞。

许可证与可复现构建说明见 [tools/space-cadet/BUILD.md](../tools/space-cadet/BUILD.md)。
