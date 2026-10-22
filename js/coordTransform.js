/**
 * VoicePath AI: Coordinate Transform Engine
 * Converts physical metric trace space (meters, East-North, heading in degrees)
 * into map.json SVG pixel coordinate space (+X East/Right, +Y South/Down).
 */

/**
 * Transforms a metric coordinate point into SVG pixel coordinates based on an anchor and scale.
 * 
 * Trace Space:
 * - Metric coordinates (meters): (x, y) relative to initial trace origin.
 * - +x points along user's initial orientation (Forward / East).
 * - +y points leftward / North (standard right-handed Cartesian).
 * 
 * SVG Screen Space:
 * - Origin (0, 0) at top-left.
 * - +X points Right (East).
 * - +Y points DOWN (South) [Inverted Y-axis].
 * 
 * @param {{ x: number, y: number }} pointM - point in trace space (meters)
 * @param {{ x: number, y: number }} anchorM - anchor origin in trace space (meters)
 * @param {{ x: number, y: number }} anchorSvg - anchor position in SVG pixels
 * @param {number} headingOffsetDeg - rotation angle from trace forward to SVG East (degrees)
 * @param {number} scalePxPerMeter - scale factor (default: 12 pixels per meter)
 * @returns {{ x: number, y: number }} SVG pixel coordinates (rounded to integers)
 */
export function transformMetricToSvg(
  pointM,
  anchorM = { x: 0, y: 0 },
  anchorSvg = { x: 100, y: 100 },
  headingOffsetDeg = 0,
  scalePxPerMeter = 12
) {
  const dxM = pointM.x - anchorM.x;
  const dyM = pointM.y - anchorM.y;

  const rad = (headingOffsetDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Rotate metric coordinates by heading offset
  const rotX = dxM * cos - dyM * sin;
  const rotY = dxM * sin + dyM * cos;

  // In SVG space, Y increases DOWNWARDS (+rotY in Cartesian corresponds to +Y downwards if forward is East and left is North)
  // When walking East (+rotX): X increases.
  // When turning Right (South in map): Y increases in SVG (+Y).
  const svgX = Math.round(anchorSvg.x + rotX * scalePxPerMeter);
  const svgY = Math.round(anchorSvg.y + rotY * scalePxPerMeter);

  return { x: svgX, y: svgY };
}

/**
 * Converts a sequence of metric trace waypoints into SVG nodes and edges.
 * @param {Array<{ x: number, y: number, t: number }>} waypoints
 * @param {{ x: number, y: number }} anchorSvg
 * @param {number} scalePxPerMeter
 * @returns {{ nodes: Object, edges: Array }}
 */
export function traceToGraph(waypoints, anchorSvg = { x: 100, y: 100 }, scalePxPerMeter = 12) {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    return { nodes: {}, edges: [] };
  }

  const anchorM = waypoints[0];
  const nodes = {};
  const edges = [];

  waypoints.forEach((wp, idx) => {
    const nodeId = `wpt_${idx + 1}`;
    const svgPos = transformMetricToSvg(wp, anchorM, anchorSvg, 0, scalePxPerMeter);
    nodes[nodeId] = {
      x: svgPos.x,
      y: svgPos.y,
      name: idx === 0 ? "Trace Start" : (idx === waypoints.length - 1 ? "Trace Destination" : `Waypoint ${idx + 1}`),
      type: idx === 0 ? "entrance" : (idx === waypoints.length - 1 ? "room" : "junction")
    };

    if (idx > 0) {
      const prevId = `wpt_${idx}`;
      const prevWp = waypoints[idx - 1];
      const dist = Math.hypot(wp.x - prevWp.x, wp.y - prevWp.y);
      edges.push({
        id: `e_${prevId}_${nodeId}`,
        from: prevId,
        to: nodeId,
        dist: Math.round(dist * 10) / 10,
        stepFree: false // Unconfirmed edges default to stepFree = false
      });
    }
  });

  return { nodes, edges };
}
