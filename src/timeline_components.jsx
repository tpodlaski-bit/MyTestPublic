import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const colorBySeverity = {
  critical: '#b91c1c',
  high: '#fb923c',
  medium: '#facc15',
  low: '#10b981',
};

const LINK_RED = '#f87171';
const LINK_BLUE = '#3b82f6';
const LINK_DELAY = '#d97706';

// Render the interactive timeline visualization with D3.
export function Timeline({ data, groupFields, badgeFields, arrowMode, customLinks, setCustomLinks, showTeamZones }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [linkPopup, setLinkPopup] = useState(null); // { x, y, event }
  const [linkIntent, setLinkIntent] = useState(null); // { from, color }
  const [deletePopup, setDeletePopup] = useState(null); // { x, y, rid }

  // Select a link color for the pending custom connection.
  const handleChooseColor = (color) => {
    if (!linkPopup) return;
    setLinkIntent({ from: linkPopup.event, color });
    setLinkPopup(null);
  };

  useEffect(() => {
    setLinkPopup(null); // clear any stray popups on rerender

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 160 };
    const width = (svgRef.current?.clientWidth || 900) - margin.left - margin.right;
    const height = (svgRef.current?.clientHeight || 600) - margin.top - margin.bottom;
    svg.attr('height', Math.max(360, height + margin.top + margin.bottom));

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const bandsG = g.append('g').attr('class', 'lane-bands');
    const xAxisG = g.append('g').attr('class', 'x axis').attr('transform', `translate(0,${height})`);
    const lanesG = g.append('g').attr('class', 'lanes');
    bandsG.lower(); // keep tinted zones behind everything else

    const domainKeys = (() => {
      if (groupFields?.length) {
        const combined = data.map((d) => groupFields.map((f) => d[f] || 'Unknown').join(' | '));
        return Array.from(new Set(combined)).sort();
      }
      return Array.from(new Set(data.map((d) => d.asset || 'Unknown'))).sort();
    })();

    // Convert lane keys to display labels.
    const labelFor = (k) => k;
    const laneHeight = Math.max(26, Math.floor(height / Math.max(domainKeys.length, 1)));
    const innerHeight = laneHeight * Math.max(domainKeys.length, 1);

    const times = data.flatMap((d) => [d.start, d.end || d.start]).filter((t) => t instanceof Date && !Number.isNaN(+t));
    let minT = d3.min(times);
    let maxT = d3.max(times);
    if (!minT || !maxT) {
      const now = new Date();
      minT = new Date(now.getTime() - 1000 * 60 * 60 * 24);
      maxT = new Date(now.getTime() + 1000 * 60 * 60 * 24);
    } else if (+minT === +maxT) {
      minT = new Date(minT.getTime() - 1000 * 60 * 60);
      maxT = new Date(maxT.getTime() + 1000 * 60 * 60);
    }

    let x = d3.scaleTime().domain([minT, maxT]).range([0, width]).nice();
    const y = d3.scaleBand().domain(domainKeys).range([0, innerHeight]).padding(0.2);

    const teamBandsActive = showTeamZones && groupFields?.includes('team');
    const bandData = teamBandsActive
      ? domainKeys
          .map((key) => {
            const lower = String(key).toLowerCase();
            const team =
              lower.includes('red') ? 'red' : lower.includes('blue') ? 'blue' : lower.includes('gray') ? 'gray' : null;
            return { key, team };
          })
          .filter((d) => d.team)
      : [];

    const bandColor = {
      red: 'rgba(239, 68, 68, 0.16)',
      blue: 'rgba(37, 99, 235, 0.16)',
      gray: 'rgba(107, 114, 128, 0.18)',
    };

    bandsG
      .selectAll('.team-band')
      .data(bandData, (d) => d.key)
      .join(
        (enter) => enter.append('rect').attr('class', 'team-band'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('x', 0)
      .attr('y', (d) => y(d.key) || 0)
      .attr('width', width)
      .attr('height', y.bandwidth())
      .attr('fill', (d) => bandColor[d.team] || 'transparent')
      .attr('rx', 10)
      .attr('pointer-events', 'none');

    const spanMs = +maxT - +minT;
    let tf = d3.timeFormat('%Y-%m-%d');
    if (spanMs > 1000 * 60 * 60 * 24 * 365 * 2) tf = d3.timeFormat('%Y');
    else if (spanMs > 1000 * 60 * 60 * 24 * 90) tf = d3.timeFormat('%b %Y');
    else if (spanMs > 1000 * 60 * 60 * 24 * 2) tf = d3.timeFormat('%b %d');
    else tf = d3.timeFormat('%H:%M');

    const ticks = Math.max(3, Math.min(10, Math.floor(width / 120)));
    const xAxis = d3.axisBottom(x).ticks(ticks).tickFormat(tf).tickSizeOuter(0);
    xAxisG.attr('transform', `translate(0,${innerHeight})`).call(xAxis);

    const lane = lanesG
      .selectAll('.lane')
      .data(domainKeys)
      .join('g')
      .attr('class', 'lane')
      .attr('transform', (d) => `translate(0,${y(d)})`);

    lane
      .append('text')
      .attr('class', 'lane-label')
      .attr('x', -20)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => labelFor(d));

    // Build a grouping key for each event based on active fields.
    function laneKeyFor(d) {
      if (groupFields?.length) return groupFields.map((f) => d[f] || 'Unknown').join(' | ');
      return d.asset || 'Unknown';
    }

    // Fixed badge width for consistent layouts.
    function badgeWidthFor() {
      return 260;
    }
    // Compute badge height from enabled badge fields.
    function badgeHeightFor(d) {
      let lines = 0;
      if (badgeFields.includes('title')) lines += 1;
      if (badgeFields.includes('asset')) lines += 1;
      if (badgeFields.includes('host')) lines += 1;
      if (badgeFields.includes('description')) lines += 1;
      if (badgeFields.includes('category') || badgeFields.includes('severity')) lines += 1;
      if (badgeFields.includes('time')) lines += 1;
      return Math.max(50, 8 + lines * 12);
    }

    const incidentGroups = lanesG
      .selectAll('.incident-group')
      .data(data, (d) => d.id)
      .join((enter) => {
        const gEnter = enter.append('g').attr('class', 'incident-group');
        gEnter.append('circle').attr('class', 'incident');
        gEnter.append('rect').attr('class', 'badge');
        gEnter.append('text').attr('class', 'badge-text');
        return gEnter;
      });

    // Populate badge text lines based on enabled fields.
    function updateBadgeText(g, d, bx, by) {
      g.selectAll('text.badge-text').remove();
      const badgeText = g
        .append('text')
        .attr('class', 'badge-text')
        .attr('x', bx + 6)
        .attr('y', by + 12)
        .attr('fill', '#4b5563')
        .attr('font-size', 10)
        .attr('font-family', 'monospace')
        .attr('pointer-events', 'none');
      let dy = 0;
      if (badgeFields.includes('title')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', dy === 0 ? 0 : 12).text(d.title || '(no title)');
        dy = 12;
      }
      if (badgeFields.includes('description')) {
        const desc = (d.description || 'No description').replace(/\s+/g, ' ');
        const short = desc.length > 90 ? `${desc.slice(0, 87)}...` : desc;
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(short);
        dy = 12;
      }
      if (badgeFields.includes('asset')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`Entity: ${d.asset || 'Unknown'}`);
        dy = 12;
      }
      if (badgeFields.includes('host')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`Host: ${d.host || 'Unknown'}`);
        dy = 12;
      }
      if (badgeFields.includes('team')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`Team: ${d.team || 'Unknown'}`);
        dy = 12;
      }
      if (badgeFields.includes('tactic')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`Tactic: ${d.tactic || 'Unknown'}`);
        dy = 12;
      }
      if (badgeFields.includes('severity')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`Severity: ${d.severity || 'Unknown'}`);
        dy = 12;
      }
      if (badgeFields.includes('category')) {
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`System: ${d.category || 'Unknown'}`);
        dy = 12;
      }
      if (badgeFields.includes('time')) {
        const end = d.end ? d.end.toISOString() : '';
        badgeText.append('tspan').attr('x', bx + 6).attr('dy', 12).text(`${d.start?.toISOString() || ''}${end ? ` → ${end}` : ''}`);
        dy = 12;
      }
    }

    // Arrowhead defs for default and custom links
    const defs = svg.append('defs');
    ['red', 'blue', 'delay'].forEach((color) => {
      const m = defs.append('marker').attr('id', `arrowhead-${color}`).attr('viewBox', '0 0 10 10').attr('refX', 10).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto');
      const fill = color === 'red' ? LINK_RED : color === 'blue' ? LINK_BLUE : LINK_DELAY;
      m.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', fill);
    });

    // Ensure arrowhead markers exist for all colors.
    function ensureArrowhead() {
      const ids = ['arrowhead-blue', 'arrowhead-red', 'arrowhead-delay'];
      ids.forEach((id) => {
        if (!svg.select(`#${id}`).node()) {
          const defsNode = svg.select('defs');
          const isRed = id.includes('red');
          const isDelay = id.includes('delay');
          const marker = defsNode.append('marker').attr('id', id).attr('viewBox', '0 0 10 10').attr('refX', 10).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto');
          const fill = isRed ? LINK_RED : isDelay ? LINK_DELAY : LINK_BLUE;
          marker.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', fill);
        }
      });
    }

    // Draw default arrows for ordered events in each lane.
    function drawArrows(scaleX) {
      if (arrowMode !== 'show') {
        lanesG.selectAll('.arrow-path').remove();
        return;
      }
      ensureArrowhead();
      const eventsByLane = {};
      data.forEach((evt) => {
        const laneKey = laneKeyFor(evt);
        if (!eventsByLane[laneKey]) eventsByLane[laneKey] = [];
        eventsByLane[laneKey].push(evt);
      });
      lanesG.selectAll('.arrow-path').remove();
      Object.entries(eventsByLane).forEach(([laneKey, evts]) => {
        evts.sort((a, b) => +new Date(a.start) - +new Date(b.start));
        for (let i = 0; i < evts.length - 1; i++) {
          const from = evts[i];
          const to = evts[i + 1];
          const fromX = scaleX(from.start);
          const fromY = y(laneKey) + y.bandwidth() / 2;
          const toX = scaleX(to.start);
          const toY = y(laneKey) + y.bandwidth() / 2;
          const midX = (fromX + toX) / 2;
          const path = `M${fromX},${fromY} C${midX},${fromY - 24} ${midX},${toY + 24} ${toX},${toY}`;
          lanesG
            .append('path')
            .attr('class', 'arrow-path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', LINK_BLUE)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead-blue)')
            .attr('stroke-dasharray', '6 4')
            .attr('stroke-dashoffset', 50)
            .transition()
            .duration(700)
            .attr('stroke-dashoffset', 0);
        }
      });
    }

    // Draw custom connection lines and labels.
    function renderCustomLinks(scaleX) {
      lanesG.selectAll('.custom-line').remove();
      lanesG.selectAll('.custom-line-label').remove();
      if (arrowMode !== 'custom') return;
      ensureArrowhead();
      const byId = new Map(data.map((d) => [d.id, d]));
      customLinks.forEach((link, idx) => {
        const from = byId.get(link.from?.id) || link.from;
        const to = byId.get(link.to?.id) || link.to;
        if (!from || !to) return;
        const fromX = scaleX(from.start);
        const fromY = y(laneKeyFor(from)) + y.bandwidth() / 2;
        const toX = scaleX(to.start);
        const toY = y(laneKeyFor(to)) + y.bandwidth() / 2;
        const timeDiff = +new Date(to.start) - +new Date(from.start);
        const minutes = Math.floor(timeDiff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        let label = '';
        if (days > 0) label = `${days}d ${hours % 24}h`;
        else if (hours > 0) label = `${hours}h ${minutes % 60}m`;
        else label = `${minutes}m`;
        const color = link.color === 'blue' ? LINK_BLUE : link.color === 'delay' ? LINK_DELAY : LINK_RED;
        const midX = (fromX + toX) / 2;
        const ctrlY = ((fromY + toY) / 2) - 24;
        const path = `M${fromX},${fromY} Q${midX},${ctrlY} ${toX},${toY}`;
        const rid = link.id || `idx-${idx}`;
        lanesG
          .append('path')
          .attr('class', 'custom-line')
          .attr('d', path)
          .attr('stroke', color)
          .attr('stroke-width', 1.6)
          .attr('stroke-dasharray', '5 4')
          .attr('fill', 'none')
          .attr('marker-end', link.color === 'red' ? 'url(#arrowhead-red)' : link.color === 'delay' ? 'url(#arrowhead-delay)' : 'url(#arrowhead-blue)')
          .attr('data-id', rid)
          .style('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            const bbox = svgRef.current?.getBoundingClientRect?.();
            const offsetX = bbox ? bbox.left : 0;
            const offsetY = bbox ? bbox.top : 0;
            setDeletePopup({ x: event.pageX - offsetX, y: event.pageY - offsetY, rid });
          });
        lanesG
          .append('text')
          .attr('class', 'custom-line-label')
          .attr('x', midX)
          .attr('y', ctrlY - 4)
          .attr('text-anchor', 'middle')
          .attr('fill', color)
          .attr('font-size', 11)
          .style('cursor', 'pointer')
          .text(label)
          .on('click', (event) => {
            event.stopPropagation();
            const bbox = svgRef.current?.getBoundingClientRect?.();
            const offsetX = bbox ? bbox.left : 0;
            const offsetY = bbox ? bbox.top : 0;
            setDeletePopup({ x: event.pageX - offsetX, y: event.pageY - offsetY, rid });
          });
      });
    }

    // Compute badge placement offsets to avoid overlaps.
    function computePlacements(scaleX) {
      const laneStacks = {};
      const placements = new Map();
      const sorted = data.slice().sort((a, b) => +new Date(a.start) - +new Date(b.start));
      sorted.forEach((d) => {
        const laneKey = laneKeyFor(d);
        const idx = laneStacks[laneKey] || 0;
        laneStacks[laneKey] = idx + 1;
        const bw = badgeWidthFor(d);
        const bh = badgeHeightFor(d);
        const baseX = scaleX(d.start);
        const laneCenterY = y(laneKey) + y.bandwidth() / 2;
        const isEven = idx % 2 === 0;
        const offsetStep = Math.floor(idx / 2) + 1;
        let bx = baseX + 10;
        let by = isEven
          ? laneCenterY - (bh + 6) * offsetStep
          : laneCenterY + (bh + 6) * offsetStep;
        bx = Math.max(4, Math.min(bx, width - bw - 4));
        const maxY = innerHeight - bh - 4;
        by = Math.max(4, Math.min(by, maxY));
        placements.set(d.id, { bx, by, bw, bh });
      });
      return placements;
    }

    const placements = computePlacements(x);

    incidentGroups.each(function (d) {
      const g = d3.select(this);
      const cx = x(d.start);
      const cy = y(laneKeyFor(d)) + y.bandwidth() / 2;
      const radius = 6;
      const circle = g.select('circle.incident');
      circle
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', radius)
        .attr('fill', colorBySeverity[d.severity] || '#6b7280')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      const placement = placements.get(d.id);
      const bw = placement?.bw ?? badgeWidthFor(d);
      const bh = placement?.bh ?? badgeHeightFor(d);
      const bx = placement?.bx ?? cx + 10;
      const by = placement?.by ?? cy - bh / 2;

      g.selectAll('.badge-connector').remove();
      g.selectAll('rect.badge').remove();
      g.selectAll('text.badge-text').remove();

      g.append('rect').attr('class', 'badge').attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh).attr('rx', 4).attr('ry', 4);
      updateBadgeText(g, d, bx, by);

      const textAnchorX = bx + 6;
      const textAnchorY = by + 12;
      g.append('line')
        .attr('class', 'badge-connector')
        .attr('x1', cx)
        .attr('y1', cy)
        .attr('x2', textAnchorX)
        .attr('y2', textAnchorY)
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'none');

      const circleElem = g.select('circle.incident');
      circleElem
        .on('mousemove', (event) => {
          tooltip
            .classed('hidden', false)
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY + 10 + 'px')
            .html(
              `<strong>${d.title}</strong><br/>${d.asset || ''} · ${d.severity}<br/>${d.start?.toLocaleString() || ''}<br/><small>${d.category || ''}</small><div style="margin-top:4px">${d.description || ''}</div>`,
            );
        })
        .on('mouseleave', () => tooltip.classed('hidden', true))
        .on('click', (event) => {
          if (arrowMode !== 'custom') return;
          if (linkIntent && linkIntent.from.id !== d.id) {
            setCustomLinks((prev) => [
              ...prev,
              { id: 'link-' + Date.now(), from: linkIntent.from, to: d, color: linkIntent.color },
            ]);
            setLinkIntent(null);
            setLinkPopup(null);
            return;
          }
          const bbox = svgRef.current?.getBoundingClientRect?.();
          const offsetX = bbox ? bbox.left : 0;
          const offsetY = bbox ? bbox.top : 0;
          setLinkPopup({ x: event.pageX - offsetX, y: event.pageY - offsetY, event: d });
        });
    });

    // Update positions on zoom/pan.
    const zoomed = (event) => {
      const zx = event.transform.rescaleX(x);
      xAxisG.call(xAxis.scale(zx));
      incidentGroups.each(function (d) {
        const g = d3.select(this);
        const circle = g.select('circle.incident');
        const cx = zx(d.start);
        const cy = y(laneKeyFor(d)) + y.bandwidth() / 2;
        circle.attr('cx', cx).attr('cy', cy);

        const placement = computePlacements(zx).get(d.id);
        const bw = placement?.bw ?? badgeWidthFor(d);
        const bh = placement?.bh ?? badgeHeightFor(d);
        const bx = placement?.bx ?? cx + 10;
        const by = placement?.by ?? cy - bh / 2;

        g.select('.badge').attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh);
        updateBadgeText(g, d, bx, by);
        g.selectAll('.badge-connector').remove();
        const textAnchorX = bx + 6;
        const textAnchorY = by + 12;
        g.append('line')
          .attr('class', 'badge-connector')
          .attr('x1', cx)
          .attr('y1', cy)
          .attr('x2', textAnchorX)
          .attr('y2', textAnchorY)
          .attr('stroke', '#9ca3af')
          .attr('stroke-width', 1.2)
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-linecap', 'round')
          .attr('pointer-events', 'none');
      });
      drawArrows(zx);
      renderCustomLinks(zx);
    };

    const zoomBehavior = d3.zoom().scaleExtent([0.5, 20]).translateExtent([
      [-margin.left, -Infinity],
      [width + margin.right, Infinity],
    ]);
    svg.call(zoomBehavior.on('zoom', zoomed));
    svg.on('dblclick.zoom', null);

    drawArrows(x);
    renderCustomLinks(x);
  }, [data, groupFields, badgeFields, arrowMode, customLinks, linkIntent, showTeamZones]);

  return (
    <div className="timeline-shell">
      <svg ref={svgRef} className="timeline-svg" />
      <div ref={tooltipRef} className="tooltip hidden" />
      {arrowMode === 'custom' && <div className="hint">Custom mode: click an incident, pick red/blue, then click the target incident.</div>}
      {arrowMode === 'custom' && linkPopup && (
        <div className="link-popup" style={{ left: linkPopup.x + 4, top: linkPopup.y + 4 }}>
          <div className="link-popup-title">Draw line color</div>
          <div className="popup-actions">
            <button className="red" onClick={() => handleChooseColor('red')}>
              Red
            </button>
            <button className="blue" onClick={() => handleChooseColor('blue')}>
              Blue
            </button>
            <button style={{ background: LINK_DELAY, color: '#fff' }} onClick={() => handleChooseColor('delay')}>
              Delay
            </button>
          </div>
        </div>
      )}
      {arrowMode === 'custom' && deletePopup && (
        <div className="link-popup" style={{ left: deletePopup.x + 4, top: deletePopup.y + 4 }}>
          <div className="link-popup-title">Delete arrow?</div>
          <div className="popup-actions">
            <button
              className="red"
              onClick={() => {
                setCustomLinks((prev) =>
                  prev.filter((l, i) => (l.id || `idx-${i}`) !== deletePopup.rid),
                );
                setDeletePopup(null);
              }}
            >
              Delete
            </button>
            <button className="ghost" onClick={() => setDeletePopup(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
