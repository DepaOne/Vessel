export function tokenizePath(d) {
    // Robust tokenizer: commands + numbers (handles 135.5.49 => 135.5, 0.49)
    const tokens = [];
    const re = /([a-zA-Z])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    let m;
    while ((m = re.exec(d)) !== null) tokens.push(m[1] || m[2]);
    return tokens;
}

export function svgPathToPoints(d, timeBudgetMs = Infinity) {
    const tokens = tokenizePath(d || '');
    let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
    let pcx = null, pcy = null;
    const pts = [];
    const read = () => parseFloat(tokens[i++]);
    const isCmd = t => /^[a-zA-Z]$/.test(t);
    const add = (x, y) => { pts.push({ x, y }); cx = x; cy = y; };
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;

    const MIN_CURVE_SAMPLES = 10, MAX_CURVE_SAMPLES = 120;
    const adaptiveQ = (x0, y0, x1, y1, x2, y2) => {
        const chord = Math.hypot(x2 - x0, y2 - y0);
        const ctrl = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
        const c = Math.min(1, (ctrl - chord) / (chord + 1e-6));
        return Math.round(MIN_CURVE_SAMPLES + c * (MAX_CURVE_SAMPLES - MIN_CURVE_SAMPLES));
    };
    const adaptiveC = (x0, y0, x1, y1, x2, y2, x3, y3) => {
        const chord = Math.hypot(x3 - x0, y3 - y0);
        const ctrl = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
        const c = Math.min(1, (ctrl - chord) / (chord + 1e-6));
        return Math.round(MIN_CURVE_SAMPLES + c * (MAX_CURVE_SAMPLES - MIN_CURVE_SAMPLES));
    };
    const sampleQ = (x0, y0, x1, y1, x2, y2, n) => {
        const out = []; for (let s = 1; s <= n; s++) {
            const t = s / n, mt = 1 - t;
            out.push({ x: mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, y: mt * mt * y0 + 2 * mt * t * y1 + t * t * y2 });
        }
        return out;
    };
    const sampleC = (x0, y0, x1, y1, x2, y2, x3, y3, n) => {
        const out = []; for (let s = 1; s <= n; s++) {
            const t = s / n, mt = 1 - t;
            out.push({
                x: mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
                y: mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
            });
        }
        return out;
    };

    while (i < tokens.length) {
        if (isCmd(tokens[i])) cmd = tokens[i++];
        const abs = cmd === cmd.toUpperCase();
        const C = cmd.toUpperCase();

        switch (C) {
            case 'M': {
                const x = read(), y = read();
                if (abs) { cx = x; cy = y; } else { cx += x; cy += y; }
                add(cx, cy); sx = cx; sy = cy;
                while (i < tokens.length && !isCmd(tokens[i])) {
                    const x2 = read(), y2 = read();
                    if (abs) { cx = x2; cy = y2; } else { cx += x2; cy += y2; }
                    add(cx, cy);
                }
                pcx = pcy = null;
                break;
            }
            case 'L': case 'H': case 'V': {
                while (i < tokens.length && !isCmd(tokens[i])) {
                    if (C === 'L') {
                        const x = read(), y = read();
                        if (abs) { cx = x; cy = y; } else { cx += x; cy += y; }
                    } else if (C === 'H') {
                        const x = read(); cx = abs ? x : cx + x;
                    } else {
                        const y = read(); cy = abs ? y : cy + y;
                    }
                    add(cx, cy);
                }
                pcx = pcy = null;
                break;
            }
            case 'Q': {
                while (i + 3 < tokens.length && !isCmd(tokens[i])) {
                    const x1 = read(), y1 = read(), x = read(), y = read();
                    const X1 = abs ? x1 : cx + x1, Y1 = abs ? y1 : cy + y1;
                    const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                    sampleQ(cx, cy, X1, Y1, X, Y, adaptiveQ(cx, cy, X1, Y1, X, Y)).forEach(p => add(p.x, p.y));
                    pcx = X1; pcy = Y1;
                }
                break;
            }
            case 'T': {
                while (i + 1 < tokens.length && !isCmd(tokens[i])) {
                    const x = read(), y = read();
                    const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                    const X1 = (pcx != null && pcy != null) ? cx + (cx - pcx) : cx;
                    const Y1 = (pcx != null && pcy != null) ? cy + (cy - pcy) : cy;
                    sampleQ(cx, cy, X1, Y1, X, Y, adaptiveQ(cx, cy, X1, Y1, X, Y)).forEach(p => add(p.x, p.y));
                    pcx = X1; pcy = Y1;
                }
                break;
            }
            case 'C': {
                while (i + 5 < tokens.length && !isCmd(tokens[i])) {
                    const x1 = read(), y1 = read(), x2 = read(), y2 = read(), x = read(), y = read();
                    const X1 = abs ? x1 : cx + x1, Y1 = abs ? y1 : cy + y1;
                    const X2 = abs ? x2 : cx + x2, Y2 = abs ? y2 : cy + y2;
                    const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                    sampleC(cx, cy, X1, Y1, X2, Y2, X, Y, adaptiveC(cx, cy, X1, Y1, X2, Y2, X, Y)).forEach(p => add(p.x, p.y));
                    pcx = X2; pcy = Y2;
                }
                break;
            }
            case 'S': {
                while (i + 3 < tokens.length && !isCmd(tokens[i])) {
                    const x2 = read(), y2 = read(), x = read(), y = read();
                    const X1 = (pcx != null && pcy != null) ? cx + (cx - pcx) : cx;
                    const Y1 = (pcx != null && pcy != null) ? cy + (cy - pcy) : cy;
                    const X2 = abs ? x2 : cx + x2, Y2 = abs ? y2 : cy + y2;
                    const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                    sampleC(cx, cy, X1, Y1, X2, Y2, X, Y, adaptiveC(cx, cy, X1, Y1, X2, Y2, X, Y)).forEach(p => add(p.x, p.y));
                    pcx = X2; pcy = Y2;
                }
                break;
            }
            case 'A': {
                // For brevity, add arc handling here if you need it
                // (you already have arc helpers in SVGImporter; you can move them in too)
                // Fallback: treat as line to end point if not implemented.
                while (i + 6 < tokens.length && !isCmd(tokens[i])) {
                    const rx = read(), ry = read(), phi = read(), fa = read(), fs = read(), x = read(), y = read();
                    const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                    add(X, Y);
                    pcx = pcy = null;
                }
                break;
            }
            case 'Z': { add(sx, sy); pcx = pcy = null; break; }
            default: { while (i < tokens.length && !isCmd(tokens[i])) i++; pcx = pcy = null; }
        }
        if (performance.now && performance.now() - t0 > timeBudgetMs) break;
    }
    return { points: pts, aborted: false };
}

export function normalizeProfile(points, { resampleTarget } = {}) {
    if (!Array.isArray(points) || points.length < 2) return [];
    // X shift to axis
    const minX = Math.min(...points.map(p => p.x));
    let pts = points.map(p => ({ x: p.x - minX, y: p.y }));
    // Flip up if needed
    if (pts[0].y > pts[pts.length - 1].y) {
        const maxY = Math.max(...pts.map(p => p.y));
        pts = pts.map(p => ({ x: p.x, y: maxY - p.y }));
    }
    // Y shift to bottom
    const minY = Math.min(...pts.map(p => p.y));
    pts = pts.map(p => ({ x: p.x, y: p.y - minY }));
    // Optional: resample by Y
    if (resampleTarget && resampleTarget >= 2) {
        const sorted = [...pts].sort((a, b) => a.y - b.y);
        const out = []; let j = 0;
        const y0 = sorted[0].y, y1 = sorted[sorted.length - 1].y;
        for (let i = 0; i < resampleTarget; i++) {
            const y = y0 + (i / (resampleTarget - 1)) * (y1 - y0);
            while (j < sorted.length - 2 && y > sorted[j + 1].y) j++;
            const a = sorted[j], b = sorted[j + 1] || a, dy = b.y - a.y;
            const t = Math.abs(dy) < 1e-12 ? 0 : (y - a.y) / dy;
            const x = a.x + t * (b.x - a.x);
            out.push({ x: Math.max(0, x), y });
        }
        pts = out;
    }
    return pts;
}