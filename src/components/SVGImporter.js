import React, { useState, useRef } from 'react';

// Safe-mode flag (toggle in DevTools or before load): localStorage.setItem('VESSEL_SAFE','1')
const SAFE_MODE = typeof window !== 'undefined' && localStorage.getItem('VESSEL_SAFE') === '1';

// Tune caps here (lower in safe mode to prevent freezes)
const MAX_PROFILE_POINTS = SAFE_MODE ? 300 : 400;
const TARGET_PROFILE_POINTS = SAFE_MODE ? 180 : 220;
const MIN_CURVE_SAMPLES = 4;
const MAX_CURVE_SAMPLES = SAFE_MODE ? 16 : 40;

function sampleQuadratic(x0, y0, x1, y1, x2, y2, samples) {
    const out = [];
    for (let s = 1; s <= samples; s++) {
        const t = s / samples, mt = 1 - t;
        out.push({
            x: mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
            y: mt * mt * y0 + 2 * mt * t * y1 + t * t * y2
        });
    }
    return out;
}

function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, samples) {
    const out = [];
    for (let s = 1; s <= samples; s++) {
        const t = s / samples, mt = 1 - t;
        out.push({
            x: mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
            y: mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
        });
    }
    return out;
}

function adaptiveQuadraticSamples(x0, y0, x1, y1, x2, y2) {
    const chord = Math.hypot(x2 - x0, y2 - y0);
    const ctrl = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
    const complexity = Math.min(1, (ctrl - chord) / (chord + 1e-6));
    return Math.round(MIN_CURVE_SAMPLES + complexity * (MAX_CURVE_SAMPLES - MIN_CURVE_SAMPLES));
}

function adaptiveCubicSamples(x0, y0, x1, y1, x2, y2, x3, y3) {
    const chord = Math.hypot(x3 - x0, y3 - y0);
    const ctrl = Math.hypot(x1 - x0, y1 - y0) +
        Math.hypot(x2 - x1, y2 - y1) +
        Math.hypot(x3 - x2, y3 - y2);
    const complexity = Math.min(1, (ctrl - chord) / (chord + 1e-6));
    return Math.round(MIN_CURVE_SAMPLES + complexity * (MAX_CURVE_SAMPLES - MIN_CURVE_SAMPLES));
}

// Arc helpers
const degToRad = d => (d * Math.PI) / 180;

function arcToCenterParam(x1, y1, x2, y2, fa, fs, rx, ry, phiRad) {
    const cosPhi = Math.cos(phiRad), sinPhi = Math.sin(phiRad);
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (rx === 0 || ry === 0) return { cx: NaN, cy: NaN, startAngle: 0, deltaAngle: 0, rx, ry, phiRad };

    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;

    let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }

    const rx2 = rx * rx, ry2 = ry * ry, x1p2 = x1p * x1p, y1p2 = y1p * y1p;
    const sign = (fa === fs) ? -1 : 1;
    const num = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
    const den = rx2 * y1p2 + ry2 * x1p2 || 1e-12;
    const coef = sign * Math.sqrt(Math.max(0, num / den));
    const cxp = coef * (rx * y1p) / (ry || 1e-12);
    const cyp = coef * (-ry * x1p) / (rx || 1e-12);

    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

    const ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry;
    const vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry;

    const ang = (x, y) => Math.atan2(y, x);
    let startAngle = ang(ux, uy);

    const dot = ux * vx + uy * vy;
    const m1 = Math.hypot(ux, uy), m2 = Math.hypot(vx, vy) || 1e-12;
    let deltaAngle = Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2))));
    const cross = ux * vy - uy * vx;
    if (cross < 0) deltaAngle = -deltaAngle;
    if (!fs && deltaAngle > 0) deltaAngle -= 2 * Math.PI;
    if (fs && deltaAngle < 0) deltaAngle += 2 * Math.PI;

    return { cx, cy, startAngle, deltaAngle, rx, ry, phiRad };
}

function adaptiveArcSamples(rx, ry, absDelta) {
    const avgR = (Math.abs(rx) + Math.abs(ry)) / 2;
    const estLen = avgR * absDelta;
    const n = Math.round(estLen / 10);
    return Math.min(MAX_CURVE_SAMPLES, Math.max(MIN_CURVE_SAMPLES, n));
}

function sampleArcByCenter(cx, cy, rx, ry, phiRad, startAngle, deltaAngle, samples) {
    const out = [];
    const cosPhi = Math.cos(phiRad), sinPhi = Math.sin(phiRad);
    for (let s = 1; s <= samples; s++) {
        const t = startAngle + (s / samples) * deltaAngle;
        const cosT = Math.cos(t), sinT = Math.sin(t);
        out.push({
            x: cx + rx * cosPhi * cosT - ry * sinPhi * sinT,
            y: cy + rx * sinPhi * cosT + ry * cosPhi * sinT
        });
    }
    return out;
}

// Utils
function dedupeByDistance(points, eps = 0.01) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i], prev = out[out.length - 1];
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > eps) out.push(p);
    }
    return out;
}

function collinearSimplify(points, tolerance = 0.05) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const a = out[out.length - 1], b = points[i], c = points[i + 1];
        const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
        if (area2 > tolerance) out.push(b);
    }
    out.push(points[points.length - 1]);
    return out;
}

function decimateEven(points, target) {
    const minTarget = Math.max(3, target); // ensure at least 3
    if (points.length <= minTarget) return points;
    const out = [];
    for (let i = 0; i < minTarget; i++) {
        const idx = Math.round((i / (minTarget - 1)) * (points.length - 1));
        out.push(points[idx]);
    }
    return out;
}

function resampleUniformByY(points, target) {
    if (!Array.isArray(points) || points.length < 2 || target < 2) return points;
    const sorted = [...points].sort((a, b) => a.y - b.y);

    const minY = sorted[0].y;
    const maxY = sorted[sorted.length - 1].y;
    if (!isFinite(minY) || !isFinite(maxY) || Math.abs(maxY - minY) < 1e-9) return sorted;

    const out = [];
    let j = 0;
    for (let i = 0; i < target; i++) {
        const y = minY + (i / (target - 1)) * (maxY - minY);

        while (j < sorted.length - 2 && y > sorted[j + 1].y) j++;

        const a = sorted[j];
        const b = sorted[j + 1] || a;
        const dy = b.y - a.y;

        let x;
        if (Math.abs(dy) < 1e-12) {
            // same Y: take max radius at this Y
            x = Math.max(a.x, b.x);
        } else {
            const t = (y - a.y) / dy;
            x = a.x + t * (b.x - a.x);
        }
        out.push({ x: Math.max(0, x), y });
    }
    return out;
}

const SVGImporter = ({ onProfileImported }) => {
    const [svgContent, setSvgContent] = useState('');
    const [rawPoints, setRawPoints] = useState([]);
    const [normalizedPoints, setNormalizedPoints] = useState([]);
    const [debugLines, setDebugLines] = useState([]);
    const fileInputRef = useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const svgText = e.target.result;
                setSvgContent(svgText);
                parseProfile(svgText);
            };
            reader.readAsText(file);
        }
    };

    const dlog = (msg) => setDebugLines((prev) => [...prev.slice(-30), msg]);

    const parseProfile = (svgText) => {
        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

            // Try to find different types of SVG elements
            let points = [];

            // 1. Try paths (choose the one with largest vertical span)
            const paths = svgDoc.querySelectorAll('path');
            if (paths.length > 0) {
                let best = null;
                paths.forEach((p, idx) => {
                    const d = p.getAttribute('d');
                    if (!d) return;
                    const res = svgPathToPoints(d, SAFE_MODE ? 12 : 30);
                    const pts = res.points || [];
                    if (pts.length < 2) return;

                    const ys = pts.map(pt => pt.y);
                    const xs = pts.map(pt => pt.x);
                    const yRange = Math.max(...ys) - Math.min(...ys);
                    const xRange = Math.max(...xs) - Math.min(...xs);

                    // Prefer vertical span; tie-break by count
                    const score = yRange;
                    if (!best || score > best.score || (score === best.score && pts.length > best.points.length)) {
                        best = { points: pts, idx, aborted: res.aborted, yRange, xRange, score };
                    }
                });

                if (best) {
                    points = best.points;
                    if (best.aborted) dlog(`[SVG] Parser aborted on best path #${best.idx}. Points=${points.length}`);
                    dlog(`[SVG] Selected path #${best.idx} (yRange=${best.yRange.toFixed(2)}, xRange=${best.xRange.toFixed(2)}, n=${points.length})`);
                }
            }

            // 2. Try polylines
            if (points.length === 0) {
                const polylines = svgDoc.querySelectorAll('polyline');
                if (polylines.length > 0) {
                    console.log('Found polyline elements:', polylines.length);
                    const pointsAttr = polylines[0].getAttribute('points');
                    points = polylineToPoints(pointsAttr);
                }
            }

            // 3. Try polygons
            if (points.length === 0) {
                const polygons = svgDoc.querySelectorAll('polygon');
                if (polygons.length > 0) {
                    console.log('Found polygon elements:', polygons.length);
                    const pointsAttr = polygons[0].getAttribute('points');
                    points = polylineToPoints(pointsAttr);
                }
            }

            // 4. Try lines
            if (points.length === 0) {
                const lines = svgDoc.querySelectorAll('line');
                if (lines.length > 0) {
                    console.log('Found line elements:', lines.length);
                    points = linesToPoints(lines);
                }
            }

            // 5. Try rectangles
            if (points.length === 0) {
                const rects = svgDoc.querySelectorAll('rect');
                if (rects.length > 0) {
                    console.log('Found rect elements:', rects.length);
                    points = rectToPoints(rects[0]);
                }
            }

            if (points && points.length > 0) {
                const raw = points.slice(); // keep copy before simplify

                dlog(`[SVG] Pre-simplify: ${points.length}`);
                points = dedupeByDistance(points, 0.01);
                points = collinearSimplify(points, 0.05);

                // If simplify is too aggressive, restore and relax
                if (points.length < 3) {
                    dlog('[SVG] Simplify reduced to <3. Restoring raw and relaxing tolerances.');
                    points = dedupeByDistance(raw, 0.0001); // much smaller epsilon
                    // skip collinearSimplify here, or use a tiny tolerance
                }

                // Cap but never under 3
                if (points.length > MAX_PROFILE_POINTS) {
                    dlog(`[SVG] Decimating ${points.length} -> ~${TARGET_PROFILE_POINTS}`);
                    points = decimateEven(points, TARGET_PROFILE_POINTS);
                }

                // If still <3, pad a midpoint between endpoints
                if (points.length < 3 && points.length >= 2) {
                    const a = points[0], b = points[points.length - 1];
                    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                    points = [a, mid, b];
                    dlog('[SVG] Padded midpoint to reach 3 points.');
                }

                dlog(`[SVG] Final count: ${points.length}`);

                // STEP 1: Translate so first X point is at 0 (shift to center axis)
                const minX = Math.min(...points.map(p => p.x));
                points = points.map(point => ({
                    x: point.x - minX,
                    y: point.y
                }));
                console.log('Translated points (X starts at 0):', points);

                // STEP 2: Flip if upside down
                const firstY = points[0].y;
                const lastY = points[points.length - 1].y;

                if (firstY > lastY) {
                    console.log('Flipping Y coordinates - pottery was upside down');
                    const maxY = Math.max(...points.map(p => p.y));
                    points = points.map(point => ({
                        x: point.x,
                        y: maxY - point.y // Flip Y coordinate
                    }));
                    console.log('Flipped points:', points);
                }

                // STEP 3: Translate Y to start at 0 (shift to bottom)
                const minY = Math.min(...points.map(p => p.y));
                points = points.map(point => ({
                    x: point.x,
                    y: point.y - minY // Shift Y so minimum Y becomes 0
                }));
                console.log('Final points (ready for vessel):', points);

                // Optional: even-out vertical segment density
                const desired = Math.min(TARGET_PROFILE_POINTS, MAX_PROFILE_POINTS); // allow upsampling
                const uniform = resampleUniformByY(points, desired);
                dlog(`[SVG] Uniform Y resample: ${points.length} -> ${uniform.length}`);
                points = uniform;

                // Update outputs
                setRawPoints(points);
                setNormalizedPoints(points);
                onProfileImported(points);
            }
        } catch (error) {
            console.error('Error parsing SVG:', error);
        }
    };

    const polylineToPoints = (pointsAttr) => {
        if (!pointsAttr) return [];

        const coords = pointsAttr.trim().split(/[\s,]+/).map(v => parseFloat(v));
        const points = [];

        for (let i = 0; i < coords.length; i += 2) {
            if (i + 1 < coords.length) {
                points.push({ x: coords[i], y: coords[i + 1] });
            }
        }

        return points;
    };

    const linesToPoints = (lines) => {
        const points = [];

        Array.from(lines).forEach(line => {
            const x1 = parseFloat(line.getAttribute('x1') || 0);
            const y1 = parseFloat(line.getAttribute('y1') || 0);
            const x2 = parseFloat(line.getAttribute('x2') || 0);
            const y2 = parseFloat(line.getAttribute('y2') || 0);

            points.push({ x: x1, y: y1 });
            points.push({ x: x2, y: y2 });
        });

        return points;
    };

    const rectToPoints = (rect) => {
        const x = parseFloat(rect.getAttribute('x') || 0);
        const y = parseFloat(rect.getAttribute('y') || 0);
        const width = parseFloat(rect.getAttribute('width') || 100);
        const height = parseFloat(rect.getAttribute('height') || 100);

        const points = [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height }
        ];

        return points;
    };

    // Robust tokenizer: extracts commands and numeric values (supports .49, -0.5, exponents)
    function tokenizePath(d) {
        const tokens = [];
        const re = /([a-zA-Z])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
        let m;
        while ((m = re.exec(d)) !== null) {
            tokens.push(m[1] || m[2]);
        }
        return tokens;
    }

    // Replace your tokens building line inside svgPathToPoints:
    function svgPathToPoints(pathData, timeBudgetMs = SAFE_MODE ? 16 : 50) {
        if (!pathData) return { points: [], aborted: false };
        // OLD:
        // const tokens = pathData.replace(/([a-zA-Z])/g, ' $1 ').replace(/,/g, ' ').trim().split(/\s+/);
        // NEW:
        const tokens = tokenizePath(pathData);

        let i = 0, cmd = '';
        let cx = 0, cy = 0, sx = 0, sy = 0;
        let pcx = null, pcy = null;
        const pts = [];
        const read = () => parseFloat(tokens[i++]);
        const isCmd = t => /^[a-zA-Z]$/.test(t);
        const add = (x, y) => { pts.push({ x, y }); cx = x; cy = y; };

        const t0 = performance.now();
        let aborted = false;

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
                case 'L': {
                    while (i < tokens.length && !isCmd(tokens[i])) {
                        const x = read(), y = read();
                        if (abs) { cx = x; cy = y; } else { cx += x; cy += y; }
                        add(cx, cy);
                    }
                    pcx = pcy = null;
                    break;
                }
                case 'H': {
                    while (i < tokens.length && !isCmd(tokens[i])) {
                        const x = read();
                        cx = abs ? x : cx + x;
                        add(cx, cy);
                    }
                    pcx = pcy = null;
                    break;
                }
                case 'V': {
                    while (i < tokens.length && !isCmd(tokens[i])) {
                        const y = read();
                        cy = abs ? y : cy + y;
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
                        const n = adaptiveQuadraticSamples(cx, cy, X1, Y1, X, Y);
                        sampleQuadratic(cx, cy, X1, Y1, X, Y, n).forEach(p => add(p.x, p.y));
                        pcx = X1; pcy = Y1;
                    }
                    break;
                }
                case 'T': {
                    while (i + 1 < tokens.length && !isCmd(tokens[i])) {
                        const x = read(), y = read();
                        const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                        let X1, Y1;
                        if (pcx !== null && pcy !== null) { X1 = cx + (cx - pcx); Y1 = cy + (cy - pcy); }
                        else { X1 = cx; Y1 = cy; }
                        const n = adaptiveQuadraticSamples(cx, cy, X1, Y1, X, Y);
                        sampleQuadratic(cx, cy, X1, Y1, X, Y, n).forEach(p => add(p.x, p.y));
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
                        const n = adaptiveCubicSamples(cx, cy, X1, Y1, X2, Y2, X, Y);
                        sampleCubic(cx, cy, X1, Y1, X2, Y2, X, Y, n).forEach(p => add(p.x, p.y));
                        pcx = X2; pcy = Y2;
                    }
                    break;
                }
                case 'S': {
                    while (i + 3 < tokens.length && !isCmd(tokens[i])) {
                        const x2 = read(), y2 = read(), x = read(), y = read();
                        let X1, Y1;
                        if (pcx !== null && pcy !== null) { X1 = cx + (cx - pcx); Y1 = cy + (cy - pcy); }
                        else { X1 = cx; Y1 = cy; }
                        const X2 = abs ? x2 : cx + x2, Y2 = abs ? y2 : cy + y2;
                        const X = abs ? x : cx + x, Y = abs ? y : cy + y;
                        const n = adaptiveCubicSamples(cx, cy, X1, Y1, X2, Y2, X, Y);
                        sampleCubic(cx, cy, X1, Y1, X2, Y2, X, Y, n).forEach(p => add(p.x, p.y));
                        pcx = X2; pcy = Y2;
                    }
                    break;
                }
                case 'A': {
                    while (i + 6 < tokens.length && !isCmd(tokens[i])) {
                        let rx = read(), ry = read(), phi = read();
                        const fa = read() ? 1 : 0;
                        const fs = read() ? 1 : 0;
                        const x = read(), y = read();
                        const X = abs ? x : cx + x, Y = abs ? y : cy + y;

                        if (!isFinite(rx) || !isFinite(ry) || rx === 0 || ry === 0 || !isFinite(X) || !isFinite(Y)) {
                            add(X, Y); pcx = pcy = null; continue;
                        }

                        const cp = arcToCenterParam(cx, cy, X, Y, fa, fs, rx, ry, (phi * Math.PI) / 180);
                        const samplesN = adaptiveArcSamples(cp.rx, cp.ry, Math.abs(cp.deltaAngle));
                        sampleArcByCenter(cp.cx, cp.cy, cp.rx, cp.ry, cp.phiRad, cp.startAngle, cp.deltaAngle, samplesN)
                            .forEach(p => add(p.x, p.y));
                        pcx = pcy = null;
                    }
                    break;
                }
                case 'Z': {
                    add(sx, sy);
                    pcx = pcy = null;
                    break;
                }
                default: {
                    while (i < tokens.length && !isCmd(tokens[i])) i++;
                    pcx = pcy = null;
                }
            }

            // Hard guards
            if (pts.length > MAX_PROFILE_POINTS * 3) { aborted = true; break; }
            if (performance.now() - t0 > timeBudgetMs) { aborted = true; break; }
        }

        return { points: pts, aborted };
    }

    return (
        <div className="svg-importer" style={{ marginBottom: '1rem' }}>
            <input
                type="file"
                ref={fileInputRef}
                accept=".svg"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                    padding: '8px 16px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                Import SVG Profile
            </button>
            <button
                onClick={() => {
                    // Test with a simple vase shape
                    const testPoints = [
                        { x: 0, y: 0 },
                        { x: 50, y: 0 },
                        { x: 100, y: 100 }
                    ];
                    onProfileImported(testPoints);
                }}
                style={{
                    padding: '8px 16px',
                    backgroundColor: '#333',  // Changed from '#28a745' to match first button
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginLeft: '0px'
                }}
            >
                Test Vase Shape
            </button>
            {svgContent && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#333' }}>
                    SVG imported successfully
                </div>
            )}
            {rawPoints.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
                    <details>
                        <summary>Show Point Data</summary>
                        <div>
                            <strong>Raw Points:</strong>
                            <pre>{JSON.stringify(rawPoints, null, 2)}</pre>
                            <strong>Normalized Points:</strong>
                            <pre>{JSON.stringify(normalizedPoints, null, 2)}</pre>
                        </div>
                    </details>
                </div>
            )}
            {debugLines.length > 0 && (
                <div style={{
                    position: 'fixed', left: 8, bottom: 8, maxWidth: 320,
                    background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11,
                    padding: 8, borderRadius: 4, zIndex: 9999, lineHeight: 1.3
                }}>
                    <div><strong>SVG DEBUG {SAFE_MODE ? '(SAFE)' : ''}</strong></div>
                    {debugLines.slice(-8).map((l, idx) => <div key={idx}>{l}</div>)}
                </div>
            )}
        </div>
    );
};

export default SVGImporter;