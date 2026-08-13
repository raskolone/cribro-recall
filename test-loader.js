// A test script to generate SVG paths for the loader
const tangledPath = () => {
    const points = [];
    const numPoints = 150;
    for (let i = 0; i < numPoints; i++) {
      const t = i * 0.4;
      const radius = 20 + 60 * Math.abs(Math.sin(t * 1.7) * Math.cos(t * 2.3));
      const angle = t * 3.4;
      points.push({
        x: 150 + radius * Math.cos(angle),
        y: 150 + radius * Math.sin(angle)
      });
    }
    let d = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      d += `Q ${points[i].x} ${points[i].y}, ${xc} ${yc} `;
    }
    return d;
}
console.log(tangledPath().substring(0, 100));
