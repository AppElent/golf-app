"""Derive the iOS dark and tinted icons and the transparent mark from the
generated light master (APP-274). Run from the repo root: python3 scripts/brand/derive-appearances.py
Needs numpy and Pillow. Then run node scripts/brand/make-icons.mjs."""
import numpy as np
from PIL import Image
OUT = 'docs/brand/icon'
im = np.asarray(Image.open(f'{OUT}/light.png').convert('RGB')).astype(float)
H, W, _ = im.shape
yy, xx = np.mgrid[0:H, 0:W] / (H - 1)
# Fit a quadratic background to a border band (subject never touches the edges).
band = np.zeros((H, W), bool); b = 40
band[:b] = band[-b:] = True; band[:, :b] = band[:, -b:] = True
A = np.stack([np.ones_like(xx), xx, yy, xx*yy, xx**2, yy**2], -1)
bg = np.zeros_like(im)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A[band], im[..., c][band], rcond=None)
    bg[..., c] = A @ coef
resid = np.abs(im - bg).max(-1)
# Dark field: near-black pine gradient like the other dark icons.
t = (xx * 0.85 + yy) / 1.85
top, bot = np.array([18, 48, 33.]), np.array([5, 13, 8.])
dark_bg = top * (1 - t[..., None]) + bot * t[..., None]
m = np.clip((resid - 16) / 22, 0, 1)[..., None]
yellow = ((im[...,0] > 150) & (im[...,1] > 120) & (im[...,2] < 110))[..., None]
dark = m * np.where(yellow, im, im * 0.82) + (1 - m) * dark_bg
Image.fromarray(np.clip(dark,0,255).astype(np.uint8)).save(f'{OUT}/dark.png')
lum = (0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2])
g = lum * m[..., 0]
g = np.clip(g / np.percentile(g[g > 0], 99.5) * 255, 0, 255)
Image.fromarray(np.stack([g]*3, -1).astype(np.uint8)).save(f'{OUT}/tinted.png')
# Transparent mark (subject only) for Android, splash and the lockup.
alpha = (m[..., 0] * 255).astype(np.uint8)
Image.fromarray(np.dstack([im.astype(np.uint8), alpha]), 'RGBA').save(f'{OUT}/mark.png')
