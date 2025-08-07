import React, { useState, useRef } from 'react';

const SVGImporter = ({ onProfileImported }) => {
    const [svgContent, setSvgContent] = useState('');
    const [rawPoints, setRawPoints] = useState([]);
    const [normalizedPoints, setNormalizedPoints] = useState([]);
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

    const parseProfile = (svgText) => {
        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

            // Try to find different types of SVG elements
            let points = [];

            // 1. Try paths first
            const paths = svgDoc.querySelectorAll('path');
            if (paths.length > 0) {
                console.log('Found path elements:', paths.length);
                const pathData = paths[0].getAttribute('d');
                points = svgPathToPoints(pathData);
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
                console.log('Raw SVG points:', points);

                // STEP 1: Translate so first X point is at 0 (shift to center axis)
                const minX = Math.min(...points.map(p => p.x));
                points = points.map(point => ({
                    x: point.x - minX, // Shift X so minimum X becomes 0
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

    const svgPathToPoints = (pathData) => {
        if (!pathData) return [];

        const points = [];
        const commands = pathData.replace(/([MmLlHhVvCcSsQqTtAaZz])/g, '|$1').split('|').filter(cmd => cmd.trim());

        let currentX = 0;
        let currentY = 0;

        for (const command of commands) {
            if (!command.trim()) continue;

            const type = command[0];
            const values = command.slice(1).trim();

            if (!values) continue;

            const coords = values.split(/[\s,]+/).map(v => parseFloat(v)).filter(v => !isNaN(v));

            switch (type.toLowerCase()) {
                case 'm':
                    if (coords.length >= 2) {
                        if (type === 'M') {
                            currentX = coords[0];
                            currentY = coords[1];
                        } else {
                            currentX += coords[0];
                            currentY += coords[1];
                        }
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'l':
                    if (coords.length >= 2) {
                        if (type === 'L') {
                            currentX = coords[0];
                            currentY = coords[1];
                        } else {
                            currentX += coords[0];
                            currentY += coords[1];
                        }
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'h':
                    if (coords.length >= 1) {
                        if (type === 'H') {
                            currentX = coords[0];
                        } else {
                            currentX += coords[0];
                        }
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
                case 'v':
                    if (coords.length >= 1) {
                        if (type === 'V') {
                            currentY = coords[0];
                        } else {
                            currentY += coords[0];
                        }
                        points.push({ x: currentX, y: currentY });
                    }
                    break;
            }
        }

        return points;
    };

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
        </div>
    );
};

export default SVGImporter;