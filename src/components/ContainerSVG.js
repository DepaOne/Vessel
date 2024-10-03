import React from 'react';

function ContainerSVG({ height, diameter, strokeWidth }) {
  const maxDimension = Math.max(height, diameter);
  const scale = 250 / maxDimension;
  const x = (300 - diameter * scale) / 2;
  const bottomY = 280;
  const topY = bottomY - height * scale;
  const width = diameter * scale;

  const d = `M ${x},${topY} ` +
            `V ${bottomY} ` +
            `H ${x + width} ` +
            `V ${topY}`;

  return (
    <svg id="container" width="300" height="300">
      <path
        d={d}
        fill="none"
        stroke="#363636"
        strokeWidth={strokeWidth * scale}
      />
    </svg>
  );
}

export default ContainerSVG;