import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bezier } from 'bezier-js';
import './ProfileEditor.css';

export default function ProfileEditor({ onApply, onCancel, initialPath = '' }) {
    // Model: each anchor has optional incoming (c1) and outgoing (c2) handles.
    // Segment i -> i+1 uses C p[i].c2 (control1) and p[i+1].c1 (control2)
    const [anchors, setAnchors] = useState([]);
    const [selectedIdx, setSelectedIdx] = useState(null);
    const [drag, setDrag] = useState(null); // { type: 'anchor'|'c1'|'c2'|'placing', i, sx, sy }
    const svgRef = useRef(null);

    // History (undo/redo)
    const historyRef = useRef([]);
    const redoRef = useRef([]);
    const pushHistory = (snapshot) => {
        historyRef.current.push(JSON.parse(JSON.stringify(snapshot)));
        if (historyRef.current.length > 100) historyRef.current.shift();
        redoRef.current.length = 0;
    };
    const undo = () => {
        if (!historyRef.current.length) return;
        const prev = historyRef.current.pop();
        redoRef.current.push(JSON.parse(JSON.stringify(anchors)));
        setAnchors(prev);
    };
    const redo = () => {
        if (!redoRef.current.length) return;
        const next = redoRef.current.pop();
        historyRef.current.push(JSON.parse(JSON.stringify(anchors)));
        setAnchors(next);
    };

    // Mirror preview and lock-to-right
    const [mirror, setMirror] = useState(true);
    const [lockRight, setLockRight] = useState(true);

    // Zoom/pan via viewBox
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 });
    const panRef = useRef({ active: false, startX: 0, startY: 0, vbX: 0, vbY: 0 });
    const spaceDownRef = useRef(false);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const w = svg.clientWidth || 800;
        const h = svg.clientHeight || 600;
        setViewBox({ x: 0, y: 0, w, h });
    }, []);

    // Keybindings: Space (pan), Delete, Undo/Redo
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === 'Space') { spaceDownRef.current = true; e.preventDefault(); }
            if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (e.shiftKey) redo(); else undo();
            }
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIdx != null) {
                e.preventDefault();
                pushHistory(anchors);
                deleteSelected();
            }
        };
        const onKeyUp = (e) => { if (e.code === 'Space') spaceDownRef.current = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [anchors, selectedIdx]);

    const dFromModel = useCallback(() => {
        if (anchors.length === 0) return '';
        let d = `M${anchors[0].x},${anchors[0].y}`;
        for (let i = 0; i < anchors.length - 1; i++) {
            const a = anchors[i], b = anchors[i + 1];
            if (a.c2 && b.c1) {
                d += ` C${a.c2.x},${a.c2.y},${b.c1.x},${b.c1.y},${b.x},${b.y}`;
            } else {
                d += ` L${b.x},${b.y}`;
            }
        }
        return d;
    }, [anchors]);

    // Add anchor or insert on segment (Alt), or start pan (Space/middle mouse)
    const onCanvasMouseDown = (e) => {
        const svg = svgRef.current;
        if (!svg) return;

        // Start pan
        if (e.button === 1 || spaceDownRef.current) {
            panRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                vbX: viewBox.x,
                vbY: viewBox.y
            };
            return;
        }

        if (e.button !== 0) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const mx = loc.x, my = loc.y;

        if (e.altKey && anchors.length >= 2) {
            const hit = findNearestSegment(mx, my, anchors);
            if (hit && hit.dist < 10) {
                pushHistory(anchors);
                const next = splitSegmentAt(anchors, hit.i, hit.t);
                setAnchors(next);
                return;
            }
        }

        // Click begins a new anchor. If user drags, we’ll create a curve (Illustrator-style).
        setAnchors(prev => {
            const nx = lockRight ? Math.max(0, mx) : mx;
            const next = [...prev, { x: nx, y: my }];
            pushHistory(prev);
            const newIndex = next.length - 1;
            setSelectedIdx(newIndex);
            setDrag({ type: 'placing', i: newIndex, sx: mx, sy: my }); // click-drag to curve
            return next;
        });
    };

    // Mouse wheel zoom
    const onWheel = (e) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const scale = Math.exp(-e.deltaY * 0.001); // smooth zoom
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        setViewBox(v => {
            const nw = Math.max(40, Math.min(10000, v.w * scale));
            const nh = nw * (v.h / v.w);
            const nx = p.x - (p.x - v.x) * (nw / v.w);
            const ny = p.y - (p.y - v.y) * (nh / v.h);
            return { x: nx, y: ny, w: nw, h: nh };
        });
    };

    // Pan and drag interactions
    useEffect(() => {
        const onMove = (e) => {
            const svg = svgRef.current;
            if (!svg) return;

            // Pan
            if (panRef.current.active) {
                const scaleX = viewBox.w / (svg.clientWidth || 1);
                const scaleY = viewBox.h / (svg.clientHeight || 1);
                const dx = (e.clientX - panRef.current.startX) * scaleX;
                const dy = (e.clientY - panRef.current.startY) * scaleY;
                setViewBox(v => ({ ...v, x: panRef.current.vbX - dx, y: panRef.current.vbY - dy }));
                return;
            }

            if (!drag) return;

            // Pointer in SVG coords
            const pt = svg.createSVGPoint();
            pt.x = e.clientX; pt.y = e.clientY;
            const loc = pt.matrixTransform(svg.getScreenCTM().inverse());

            // Click-drag during placement: set incoming handle on new anchor and mirror outgoing on previous
            if (drag.type === 'placing') {
                setAnchors(prev => {
                    const next = prev.slice();
                    const i = drag.i;
                    const curr = { ...next[i] };
                    const prevA = i > 0 ? { ...next[i - 1] } : null;

                    const dx = loc.x - curr.x;
                    const dy = loc.y - curr.y;
                    const movedEnough = Math.hypot(dx, dy) > 1.5;

                    if (movedEnough) {
                        curr.c1 = { x: curr.x + dx, y: curr.y + dy };
                        if (prevA) {
                            // Mirror handle for smooth join
                            prevA.c2 = { x: prevA.x - dx, y: prevA.y - dy };
                            next[i - 1] = prevA;
                        }
                        next[i] = curr;
                    }
                    return next;
                });
                return;
            }

            // Dragging existing nodes/handles
            setAnchors(prev => {
                const next = prev.slice();
                const n = { ...next[drag.i] };
                if (drag.type === 'anchor') {
                    n.x = lockRight ? Math.max(0, loc.x) : loc.x;
                    n.y = loc.y;
                } else if (drag.type === 'c1') {
                    n.c1 = { x: loc.x, y: loc.y };
                } else if (drag.type === 'c2') {
                    n.c2 = { x: loc.x, y: loc.y };
                }
                next[drag.i] = n;
                return next;
            });
        };

        const onUp = () => {
            if (panRef.current.active) panRef.current.active = false;
            if (drag) setDrag(null);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [drag, viewBox, lockRight]);

    // Nearest segment (cubic if a.c2 && b.c1, else line)
    function findNearestSegment(mx, my, pts) {
        let best = null;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            if (a.c2 && b.c1) {
                const curve = new Bezier(a.x, a.y, a.c2.x, a.c2.y, b.c1.x, b.c1.y, b.x, b.y);
                const proj = curve.project({ x: mx, y: my });
                const dist = Math.hypot(proj.x - mx, proj.y - my);
                if (!best || dist < best.dist) best = { i, mode: 'cubic', t: proj.t, x: proj.x, y: proj.y, dist };
            } else {
                const dx = b.x - a.x, dy = b.y - a.y;
                const len2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((mx - a.x) * dx + (my - a.y) * dy) / len2));
                const x = a.x + t * dx, y = a.y + t * dy;
                const dist = Math.hypot(x - mx, y - my);
                if (!best || dist < best.dist) best = { i, mode: 'line', t, x, y, dist };
            }
        }
        return best;
    }

    // Split segment i->i+1 at t, return new anchors array
    function splitSegmentAt(pts, i, t) {
        const a = pts[i], b = pts[i + 1];
        const next = pts.slice();

        if (a.c2 && b.c1) {
            const curve = new Bezier(a.x, a.y, a.c2.x, a.c2.y, b.c1.x, b.c1.y, b.x, b.y);
            const [left, right] = curve.split(t);
            const mid = { x: left.points[3].x, y: left.points[3].y };

            const a2 = { ...a, c2: { x: left.points[1].x, y: left.points[1].y } };
            const midA = {
                ...mid,
                c1: { x: left.points[2].x, y: left.points[2].y },   // mid incoming
                c2: { x: right.points[1].x, y: right.points[1].y }, // mid outgoing
            };
            const b2 = { ...b, c1: { x: right.points[2].x, y: right.points[2].y } };

            next.splice(i, 2, a2, midA, b2);
            return next;
        } else {
            const mx = a.x + (b.x - a.x) * t;
            const my = a.y + (b.y - a.y) * t;
            next.splice(i + 1, 0, { x: mx, y: my });
            return next;
        }
    }

    // Smooth the selected anchor (auto c1/c2) using a simple mirrored-handle rule
    const smoothSelected = (k = 0.3) => {
        const i = selectedIdx;
        if (i == null) return;
        const prev = anchors[i - 1], curr = anchors[i], next = anchors[i + 1];
        if (!prev || !next) return;
        const vx = next.x - prev.x, vy = next.y - prev.y;
        const len = Math.hypot(vx, vy) || 1;
        const ux = vx / len, uy = vy / len;
        const d = k * len;

        const c1 = { x: curr.x - ux * d, y: curr.y - uy * d };
        const c2 = { x: curr.x + ux * d, y: curr.y + uy * d };

        pushHistory(anchors);
        setAnchors(arr => {
            const copy = arr.slice();
            copy[i] = { ...curr, c1, c2 };
            return copy;
        });
    };

    // Convert selected join to curve (adds handles on both sides)
    const convertSelectedToCurve = () => {
        const i = selectedIdx; if (i == null) return;
        const prev = anchors[i - 1], curr = anchors[i], next = anchors[i + 1];
        if (!prev && !next) return;
        const copy = anchors.map(a => ({ ...a }));
        if (prev) {
            const dx = curr.x - prev.x, dy = curr.y - prev.y;
            copy[i - 1].c2 = { x: prev.x + dx * (2 / 3), y: prev.y + dy * (2 / 3) };
            copy[i].c1 = { x: prev.x + dx * (1 / 3), y: prev.y + dy * (1 / 3) };
        }
        if (next) {
            const dx = next.x - curr.x, dy = next.y - curr.y;
            copy[i].c2 = { x: curr.x + dx * (1 / 3), y: curr.y + dy * (1 / 3) };
            copy[i + 1].c1 = { x: curr.x + dx * (2 / 3), y: curr.y + dy * (2 / 3) };
        }
        pushHistory(anchors);
        setAnchors(copy);
    };

    // Convert selected join to straight line (clears handles around it)
    const convertSelectedToLine = () => {
        const i = selectedIdx; if (i == null) return;
        const copy = anchors.map(a => ({ ...a }));
        if (copy[i - 1]) copy[i - 1] = { ...copy[i - 1], c2: null };
        if (copy[i]) copy[i] = { ...copy[i], c1: null, c2: null };
        if (copy[i + 1]) copy[i + 1] = { ...copy[i + 1], c1: null };
        pushHistory(anchors);
        setAnchors(copy);
    };

    // Delete selected anchor
    const deleteSelected = () => {
        const i = selectedIdx; if (i == null) return;
        pushHistory(anchors);
        setAnchors(prev => {
            const next = prev.slice();
            next.splice(i, 1);
            return next;
        });
        setSelectedIdx(null);
    };

    const onDone = () => onApply?.(dFromModel());
    const onClear = () => { pushHistory(anchors); setAnchors([]); setSelectedIdx(null); };

    return (
        <div className="profile-editor">
            {/* Top toolbar (restored) */}
            <div className="toolbar">
                <button onClick={onCancel}>Cancel</button>
                <button onClick={onClear} disabled={!anchors.length}>Clear</button>
                <button onClick={() => smoothSelected()} disabled={selectedIdx == null}>Smooth</button>
                <button onClick={convertSelectedToCurve} disabled={selectedIdx == null}>Curve</button>
                <button onClick={convertSelectedToLine} disabled={selectedIdx == null}>Line</button>
                <button onClick={undo} disabled={!historyRef.current.length}>Undo</button>
                <button onClick={redo} disabled={!redoRef.current.length}>Redo</button>
                <label style={{ marginLeft: 8 }}>
                    <input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} /> Mirror
                </label>
                <label style={{ marginLeft: 8 }}>
                    <input type="checkbox" checked={lockRight} onChange={e => setLockRight(e.target.checked)} /> Lock X greater than = 0
                </label>
                <button onClick={onDone} disabled={anchors.length < 2} style={{ marginLeft: 8 }}>Done</button>
            </div>

            <svg
                ref={svgRef}
                className="editor-canvas"
                onMouseDown={onCanvasMouseDown}
                onWheel={onWheel}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="xMinYMin meet"
            >
                {/* axis line at x=0 */}
                <line className="guide-line" x1="0" y1={viewBox.y} x2="0" y2={viewBox.y + viewBox.h} />

                {/* Path preview */}
                <path className="path-preview" d={dFromModel()} />
                {mirror && (
                    <g transform="scale(-1,1)">
                        <path className="path-preview" d={dFromModel()} />
                    </g>
                )}
                {/* Handles and anchors */}
                {anchors.map((p, i) => (
                    <g key={i}>
                        {p.c1 && <line className="handle-line" x1={p.x} y1={p.y} x2={p.c1.x} y2={p.c1.y} />}
                        {p.c2 && <line className="handle-line" x1={p.x} y1={p.y} x2={p.c2.x} y2={p.c2.y} />}

                        {p.c1 && (
                            <circle
                                className="handle"
                                cx={p.c1.x}
                                cy={p.c1.y}
                                r="4"
                                onMouseDown={(e) => { e.stopPropagation(); pushHistory(anchors); setDrag({ type: 'c1', i }); }}
                            />
                        )}
                        {p.c2 && (
                            <circle
                                className="handle"
                                cx={p.c2.x}
                                cy={p.c2.y}
                                r="4"
                                onMouseDown={(e) => { e.stopPropagation(); pushHistory(anchors); setDrag({ type: 'c2', i }); }}
                            />
                        )}

                        <circle
                            className={`anchor${i === selectedIdx ? ' selected' : ''}`}
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            onMouseDown={(e) => { e.stopPropagation(); pushHistory(anchors); setSelectedIdx(i); setDrag({ type: 'anchor', i }); }}
                        />
                    </g>
                ))}
            </svg>
        </div>
    );
}