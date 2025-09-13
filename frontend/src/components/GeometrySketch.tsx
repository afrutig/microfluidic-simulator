type Props = {
  width: number;
  height: number;
};

export default function GeometrySketch({ width, height }: Props) {
  // Convert to micrometers for label, scale to fit 300x200 viewport
  const mmW = width * 1000;
  const mmH = height * 1000;
  const viewW = 320;
  const viewH = 200;
  const margin = 20;
  const scale =
    Math.min((viewW - 2 * margin) / mmW, (viewH - 2 * margin) / mmH) || 1;
  const rectW = Math.max(1, mmW * scale);
  const rectH = Math.max(1, mmH * scale);
  const x = (viewW - rectW) / 2;
  const y = (viewH - rectH) / 2;

  return (
    <svg
      width={viewW}
      height={viewH}
      viewBox={`0 0 ${viewW} ${viewH}`}
      style={{ border: "1px solid #ddd", background: "#fafafa" }}
    >
      <rect
        x={x}
        y={y}
        width={rectW}
        height={rectH}
        fill="#a5d8ff"
        stroke="#1c7ed6"
      />
      <g fill="#333" fontSize={12}>
        <text x={viewW / 2} y={y - 6} textAnchor="middle">
          Width: {mmW.toFixed(3)} mm
        </text>
        <text x={viewW / 2} y={y + rectH + 16} textAnchor="middle">
          Height: {mmH.toFixed(3)} mm
        </text>
      </g>
    </svg>
  );
}
