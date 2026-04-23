/*
 * bmpr.js
 * Copyright 2026 Lings
 *
 * Main developer: Szymon Grajner (SfymmiK)
 *
 * Licensed under the Apache License 2.0
 */

(() => {
  class BMPR extends HTMLElement {
    static get observedAttributes() {
      return [
        "src",
        "alt",
        "width",
        "height",
        "aria-label",
        "role",
        "title",
        "draggable"
      ];
    }

    constructor() {
      super();

      this._loadId = 0;
      this._complete = false;
      this._currentSrc = "";
      this._naturalWidth = 0;
      this._naturalHeight = 0;
      this._decoded = false;

      this.attachShadow({ mode: "open" });

      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", {
        alpha: true,
        willReadFrequently: false
      });

      this.fallback = document.createElement("span");
      this.styleEl = document.createElement("style");

      this.canvas.className = "bmpr-canvas";
      this.fallback.className = "bmpr-fallback";

      this.canvas.setAttribute("aria-hidden", "true");

      this.styleEl.textContent = `
        :host {
          display: inline-block;
          overflow: hidden;
          vertical-align: bottom;
          line-height: 0;
          position: relative;
        }

        .bmpr-canvas {
          display: block;
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          min-width: 0;
          min-height: 0;
          border: 0;
          margin: 0;
          padding: 0;
          object-fit: fill;
          image-rendering: pixelated;
          vertical-align: bottom;
          pointer-events: none;
        }

        .bmpr-fallback {
          display: none;
          font: 14px sans-serif;
          color: #666;
          line-height: normal;
        }

        :host([error]) .bmpr-canvas {
          display: none !important;
        }

        :host([error]) .bmpr-fallback {
          display: inline !important;
        }
      `;

      this.shadowRoot.append(this.styleEl, this.canvas, this.fallback);
    }

    connectedCallback() {
      if (!this.hasAttribute("role")) {
        this.setAttribute("role", "img");
      }

      this._applyHostDefaults();
      this.updateAccessibility();
      this.updateSize();

      if (this.src) {
        this.loadBMP().catch(() => {});
      } else {
        this._setEmptyState();
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;

      if (name === "src") {
        if (this.isConnected) this.loadBMP().catch(() => {});
        return;
      }

      if (name === "alt" || name === "aria-label" || name === "role" || name === "title") {
        this.updateAccessibility();
        return;
      }

      if (name === "width" || name === "height") {
        this.updateSize();
        return;
      }

      if (name === "draggable") {
        this.draggable = this.getAttribute("draggable") === "true";
      }
    }

    get src() {
      return this.getAttribute("src") || "";
    }

    set src(value) {
      if (value == null || value === "") this.removeAttribute("src");
      else this.setAttribute("src", value);
    }

    get alt() {
      return this.getAttribute("alt") || "";
    }

    set alt(value) {
      if (value == null) this.removeAttribute("alt");
      else this.setAttribute("alt", value);
    }

    get width() {
      const v = this.getAttribute("width");
      return v == null ? 0 : Number(v);
    }

    set width(value) {
      if (value == null || value === "") this.removeAttribute("width");
      else this.setAttribute("width", String(value));
    }

    get height() {
      const v = this.getAttribute("height");
      return v == null ? 0 : Number(v);
    }

    set height(value) {
      if (value == null || value === "") this.removeAttribute("height");
      else this.setAttribute("height", String(value));
    }

    get naturalWidth() {
      return this._naturalWidth;
    }

    get naturalHeight() {
      return this._naturalHeight;
    }

    get complete() {
      return this._complete;
    }

    get currentSrc() {
      return this._currentSrc;
    }

    async decode() {
      if (this._decoded && this._complete) return;
      await this.loadBMP();
    }

    normalizeSize(value) {
      const v = String(value).trim();
      return /^\d+$/.test(v) ? `${v}px` : v;
    }

    _applyHostDefaults() {
      const style = this.style;

      if (!style.display) style.display = "inline-block";
      if (!style.overflow) style.overflow = "hidden";
      if (!style.verticalAlign) style.verticalAlign = "bottom";
      if (!style.lineHeight) style.lineHeight = "0";
      if (!style.position) style.position = "relative";

      this.draggable = this.getAttribute("draggable") === "true";
    }

    updateAccessibility() {
      const alt = this.alt;
      this.fallback.textContent = alt;

      if (!this.hasAttribute("role")) {
        this.setAttribute("role", "img");
      }

      if (alt) {
        this.setAttribute("aria-label", alt);
      } else if (!this.hasAttribute("aria-label")) {
        this.removeAttribute("aria-label");
      }
    }

    updateSize() {
      const widthAttr = this.getAttribute("width");
      const heightAttr = this.getAttribute("height");

      if (widthAttr != null) {
        this.style.width = this.normalizeSize(widthAttr);
      } else if (this._naturalWidth > 0) {
        this.style.width = `${this._naturalWidth}px`;
      } else {
        this.style.removeProperty("width");
      }

      if (heightAttr != null) {
        this.style.height = this.normalizeSize(heightAttr);
      } else if (this._naturalHeight > 0) {
        this.style.height = `${this._naturalHeight}px`;
      } else {
        this.style.removeProperty("height");
      }

      if (this._naturalWidth > 0 && this._naturalHeight > 0) {
        this.style.aspectRatio = `${this._naturalWidth} / ${this._naturalHeight}`;
      } else {
        this.style.removeProperty("aspect-ratio");
      }

      if (widthAttr != null && heightAttr == null && this._naturalWidth && this._naturalHeight) {
        this.style.height = "auto";
      }

      if (widthAttr == null && heightAttr != null && this._naturalWidth && this._naturalHeight) {
        this.style.width = "auto";
      }
    }

    _setEmptyState() {
      this._complete = true;
      this._decoded = false;
      this._currentSrc = "";
      this._naturalWidth = 0;
      this._naturalHeight = 0;
      this.canvas.width = 1;
      this.canvas.height = 1;
      this.removeAttribute("error");
      this.canvas.style.display = "none";
      this.fallback.style.display = this.alt ? "inline" : "none";
    }

    _setErrorState(err) {
      this._complete = true;
      this._decoded = false;
      this.setAttribute("error", "");
      this.canvas.style.display = "none";
      this.fallback.style.display = "inline";
      console.error("BMPR error:", err);
      this.dispatchEvent(new Event("error"));
    }

    _clearErrorState() {
      this.removeAttribute("error");
      this.canvas.style.display = "block";
      this.fallback.style.display = "none";
    }

    async loadBMP() {
      const src = this.src;
      const loadId = ++this._loadId;

      if (!src) {
        this._setEmptyState();
        return;
      }

      this._complete = false;
      this._decoded = false;
      this._currentSrc = src;

      try {
        this._clearErrorState();

        const res = await fetch(src, { mode: "cors" });
        if (!res.ok) {
          throw new Error(`BMPR: Failed to fetch BMP (${res.status})`);
        }

        const buffer = await res.arrayBuffer();
        if (loadId !== this._loadId) return;

        const bmp = this.parseBMP(buffer);
        if (loadId !== this._loadId) return;

        this.drawBMP(bmp);
        if (loadId !== this._loadId) return;

        this._naturalWidth = bmp.width;
        this._naturalHeight = bmp.height;
        this._complete = true;
        this._decoded = true;

        this.updateSize();
        this.dispatchEvent(new Event("load"));
      } catch (err) {
        if (loadId !== this._loadId) return;
        this._setErrorState(err);
      }
    }

    parseBMP(buffer) {
      const dv = new DataView(buffer);

      if (dv.byteLength < 54) {
        throw new Error("BMPR: File too small to be a valid BMP");
      }

      if (dv.getUint16(0, true) !== 0x4D42) {
        throw new Error("BMPR: Not a BMP file");
      }

      const pixelOffset = dv.getUint32(10, true);
      const dibSize = dv.getUint32(14, true);
      const width = dv.getInt32(18, true);
      let height = dv.getInt32(22, true);
      const planes = dv.getUint16(26, true);
      const bpp = dv.getUint16(28, true);
      const compression = dv.getUint32(30, true);
      const colorsUsed = dibSize >= 36 ? dv.getUint32(46, true) : 0;

      if (planes !== 1) throw new Error("BMPR: Invalid BMP planes count");
      if (width <= 0 || height === 0) throw new Error("BMPR: Invalid BMP dimensions");
      if (compression !== 0) throw new Error("BMPR: Compressed BMP not supported");

      const topDown = height < 0;
      if (topDown) height = -height;

      if (![1, 4, 8, 24, 32].includes(bpp)) {
        throw new Error(`BMPR: Unsupported BMP bit depth: ${bpp}`);
      }

      let palette = null;

      if (bpp <= 8) {
        const paletteSize = colorsUsed || (1 << bpp);
        palette = [];
        let offset = 14 + dibSize;

        for (let i = 0; i < paletteSize; i++) {
          if (offset + 4 > dv.byteLength) {
            throw new Error("BMPR: Invalid BMP palette");
          }

          const b = dv.getUint8(offset++);
          const g = dv.getUint8(offset++);
          const r = dv.getUint8(offset++);
          offset++;
          palette.push([r, g, b, 255]);
        }
      }

      return {
        width,
        height,
        bpp,
        topDown,
        pixelOffset,
        palette,
        dv
      };
    }

    drawBMP(bmp) {
      const { width, height, bpp, topDown, pixelOffset, palette, dv } = bmp;

      this.canvas.width = width;
      this.canvas.height = height;

      const imageData = this.ctx.createImageData(width, height);
      const out = imageData.data;
      const rowSize = Math.floor((bpp * width + 31) / 32) * 4;

      for (let y = 0; y < height; y++) {
        const srcY = topDown ? y : (height - 1 - y);
        const rowStart = pixelOffset + srcY * rowSize;

        if (rowStart >= dv.byteLength) {
          throw new Error("BMPR: Invalid BMP pixel data");
        }

        if (bpp === 24) {
          for (let x = 0; x < width; x++) {
            const src = rowStart + x * 3;
            const dst = (y * width + x) * 4;
            if (src + 2 >= dv.byteLength) continue;

            out[dst] = dv.getUint8(src + 2);
            out[dst + 1] = dv.getUint8(src + 1);
            out[dst + 2] = dv.getUint8(src);
            out[dst + 3] = 255;
          }
        } else if (bpp === 32) {
          for (let x = 0; x < width; x++) {
            const src = rowStart + x * 4;
            const dst = (y * width + x) * 4;
            if (src + 3 >= dv.byteLength) continue;

            out[dst] = dv.getUint8(src + 2);
            out[dst + 1] = dv.getUint8(src + 1);
            out[dst + 2] = dv.getUint8(src);
            out[dst + 3] = dv.getUint8(src + 3);
          }
        } else if (bpp === 8) {
          for (let x = 0; x < width; x++) {
            const idxPos = rowStart + x;
            const dst = (y * width + x) * 4;
            if (idxPos >= dv.byteLength) continue;

            const idx = dv.getUint8(idxPos);
            const c = palette[idx] || [0, 0, 0, 255];

            out[dst] = c[0];
            out[dst + 1] = c[1];
            out[dst + 2] = c[2];
            out[dst + 3] = c[3];
          }
        } else if (bpp === 4) {
          for (let x = 0; x < width; x++) {
            const bytePos = rowStart + (x >> 1);
            const dst = (y * width + x) * 4;
            if (bytePos >= dv.byteLength) continue;

            const byte = dv.getUint8(bytePos);
            const idx = (x & 1) === 0 ? ((byte >> 4) & 0x0f) : (byte & 0x0f);
            const c = palette[idx] || [0, 0, 0, 255];

            out[dst] = c[0];
            out[dst + 1] = c[1];
            out[dst + 2] = c[2];
            out[dst + 3] = c[3];
          }
        } else if (bpp === 1) {
          for (let x = 0; x < width; x++) {
            const bytePos = rowStart + (x >> 3);
            const dst = (y * width + x) * 4;
            if (bytePos >= dv.byteLength) continue;

            const byte = dv.getUint8(bytePos);
            const bit = 7 - (x & 7);
            const idx = (byte >> bit) & 1;
            const c = palette[idx] || [0, 0, 0, 255];

            out[dst] = c[0];
            out[dst + 1] = c[1];
            out[dst + 2] = c[2];
            out[dst + 3] = c[3];
          }
        }
      }

      this.ctx.putImageData(imageData, 0, 0);
      this.canvas.style.display = "block";
      this.fallback.style.display = "none";
    }
  }

  if (!customElements.get("bmp-img")) {
    customElements.define("bmp-img", BMPR);
  }
})();