import { getColorScaleForColumn, initColors, getColorForMargin, getGradientColor } from './colorScale.js';
import { showResultsTable } from './details.js';

export function loadGeoJson(map, geoJsonFileUrl, precinctData, styleFeature, onEachFeature, labelMarkers) {
  fetch(geoJsonFileUrl)
    .then(response => {
      if (!response.ok) throw new Error(`Failed to load GeoJSON file: ${response.statusText}`);
      return response.json();
    })
    .then(data => {
      // Filter out features that don't have a matching row in precinctData
      const filteredFeatures = data.features.filter(feature => {
        const precinctId = feature.properties.PRECINCT;
        return precinctData.hasOwnProperty(precinctId); // Include only if matching id exists
      });

      // Create a new GeoJSON object with the filtered features
      const filteredGeoJson = { ...data, features: filteredFeatures };

      const geoJsonLayer = L.geoJSON(filteredGeoJson, {
        style: feature => styleFeature(feature, precinctData),
        onEachFeature: (feature, layer) => onEachFeature(feature, layer, precinctData, labelMarkers)
      }).addTo(map);

      map.fitBounds(geoJsonLayer.getBounds());

      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
  
      // Detect when the user starts dragging
      map.on("mousedown", (event) => {
          isDragging = false;
          dragStart = { x: event.containerPoint.x, y: event.containerPoint.y };
      });
  
      // Detect if the user moved the mouse significantly
      map.on("mousemove", (event) => {
          const moveThreshold = 5; // Minimum movement (pixels) before we count as a drag
          if (Math.abs(event.containerPoint.x - dragStart.x) > moveThreshold ||
              Math.abs(event.containerPoint.y - dragStart.y) > moveThreshold) {
              isDragging = true;
          }
      });
  
      // Only trigger the table if it was a real click, not a drag
      map.on("mouseup", (event) => {
          if (!isDragging) {
              showResultsTable();
          }
      });      
    })
    //.catch(error => alert(`Error loading GeoJSON file: ${error.message}`));
}

export function styleFeature(feature, precinctData, enabledColumns, portionColumns, totalColumns, absoluteMode, styleMode, myMap, arrowGroup) {
  const precinctId = feature.properties.PRECINCT;
  const precinctRow = precinctData[precinctId];
  if (!precinctRow) {
    return {
      fillColor: '#cccccc',
      weight: 1,
      opacity: 1,
      color: '#d3d3d3',
      fillOpacity: 0.5
    };
  }

  // Filter portionColumns and totalColumns for enabled columns
  const enabledColumnsData = portionColumns
    .map((portion, index) => ({ portion, total: totalColumns[index] }))
    .filter(({ portion }) => enabledColumns[portion]);

  const values = enabledColumnsData.map(({ portion, total }) => {
    const portionValue = parseFloat(precinctRow[portion]) || 0;
    const totalValue = absoluteMode ? 1 : parseFloat(precinctRow[total]) || 1;

    const value = absoluteMode ? portionValue : (portionValue / totalValue) * 100;
    return { column: portion, value };
  });

  if (values.length === 0) {
    return {
      fillColor: '#cccccc',
      weight: 1,
      opacity: 1,
      color: '#d3d3d3',
      fillOpacity: 0.5
    };
  }

  values.sort((a, b) => b.value - a.value);

  if (styleMode === 'winnerTakeAll') {
    const scale = getColorScaleForColumn(values[0].column);
    const fillColor = scale.base;
    return {
      fillColor,
      weight: 1,
      opacity: 1,
      color:  '#d3d3d3',
      fillOpacity: 0.7
    };
  }

  if (styleMode === 'arrows') {
    // Determine the winner and margin of victory
    const winner = values[0];
    const runnerUp = values[1] || { value: 0 }; // Handle single-column cases
    const margin = winner.value - runnerUp.value;

    // Arrow bucket thresholds
    const arrowBuckets = [0.1, 1, 2, 3, 4, 5]; // Predefined bucket thresholds
    const bucketIndex = arrowBuckets.findIndex((threshold) => margin < threshold);
    const arrowSize = bucketIndex === -1 ? arrowBuckets.length : bucketIndex;

    // Skip rendering if margin is too small
    if (arrowSize === 0) {
      return {
        fillColor: '#cccccc',
        weight: 1,
        opacity: 1,
        color:  '#d3d3d3',
        fillOpacity: 0.7,
      };
    }
    
    // Arrow direction
    const enabledIndex = enabledColumnsData.findIndex(({ portion }) => portion === winner.column); // Index in enabled columns
    const isOdd = enabledIndex % 2 === 0; // Even indices are "up-left", odd are "up-right"
    const rotation = isOdd ? 45 : -45; // Rotate arrow direction

    // Arrow color
    const colorScale = getColorScaleForColumn(winner.column);
    const arrowColor = colorScale.base;

    // Get the center of the feature
    const center = feature.geometry.type === 'Point'
      ? feature.geometry.coordinates
      : getFeatureCenter(feature);

    const arrowMarker = L.marker(center, {
      icon: L.divIcon({
        className: 'arrow-icon',
        html: createArrowSVG(arrowColor, arrowSize, rotation).outerHTML,
        iconSize: [40, 40], // Fixed size for the arrow
        iconAnchor: [20, 20], // Center the arrow on the marker position
      }),
      interactive: false, // Disable interactions like click or hover for the arrow
    });
    arrowGroup.addLayer(arrowMarker);
    //arrowMarker.addTo(myMap);

    return {
      fillColor: '#cccccc',
      weight: 1,
      opacity: 1,
      color: '#d3d3d3',
      fillOpacity: 0.7,
    };
  }    

  if (values.length > 1) {
    const margin = values[0].value - values[1]?.value || 0;
    const scale = getColorScaleForColumn(values[0].column);
    const fillColor = getColorForMargin(margin, scale);
    return {
      fillColor,
      weight: 1,
      opacity: 1,
      color: '#d3d3d3',
      fillOpacity: 0.7
    };
  }

  const scale = getColorScaleForColumn(values[0].column);
  const fillColor = getGradientColor(values[0].value, scale);
  return {
    fillColor,
    weight: 1,
    opacity: 1,
    color: '#d3d3d3',
    fillOpacity: 0.7
  };
}

export function onEachFeature(feature, layer, precinctData, portionColumns, totalColumns, absoluteMode, enabledColumns, labelMarkers, toggleLabelsCheckbox, friendlyNameMap, myMap) {
  const precinctId = feature.properties.PRECINCT;
  const precinctRow = precinctData[precinctId];
  if (!precinctRow) return;

  // Filter enabled columns
  const enabledColumnsData = portionColumns
    .map((portion, index) => ({ portion, total: totalColumns[index] }))
    .filter(({ portion }) => enabledColumns[portion]);

  const values = enabledColumnsData.map(({ portion, total }) => {
    const portionValue = parseFloat(precinctRow[portion]) || 0;
    const totalValue = absoluteMode ? 1 : parseFloat(precinctRow[total]) || 1;

    const value = absoluteMode ? portionValue : (portionValue / totalValue) * 100;
    return { column: portion, value };
  });

  values.sort((a, b) => b.value - a.value);

  const tooltipContent = `<strong>Precinct: ${precinctId}</strong><br>` + values
    .map(v =>
      absoluteMode
        ? `${friendlyNameMap[v.column] || v.column}: ${Math.round(v.value)}`
        : `${friendlyNameMap[v.column] || v.column}: ${v.value.toFixed(2)}%`
    )
    .join('<br>');

  layer.bindTooltip(tooltipContent, { sticky: true });

  // Create label marker for the precinct
  const center = layer.getBounds().getCenter();
  const labelMarker = L.marker(center, {
    icon: L.divIcon({
      className: 'label',
      html: `<div style="font-size: 12px; background: rgba(255,255,255,0.7); padding: 2px 5px; border-radius: 3px;">${precinctId}</div>`,
      iconSize: [50, 20]
    })
  });

  // Push label marker to global array (to be handled externally)
  if (typeof labelMarkers !== 'undefined') {
    labelMarkers.push(labelMarker);
  }

  if (typeof toggleLabelsCheckbox !== 'undefined' && toggleLabelsCheckbox.checked) {
    labelMarker.addTo(myMap);
  }
}

function getFeatureCenter(feature) {
  const { type, coordinates } = feature.geometry;

  if (type === 'Point') {
    // For Point, the center is the coordinate itself
    return L.latLng(coordinates[1], coordinates[0]); // [longitude, latitude]
  }

  if (type === 'Polygon') {
    // For Polygon, calculate the centroid of the first ring
    const latLngs = coordinates[0].map(coord => L.latLng(coord[1], coord[0]));
    return calculateCentroid(latLngs);
  }

  if (type === 'MultiPolygon') {
    // For MultiPolygon, calculate the centroid of the largest polygon
    const polygons = coordinates.map(polygon => polygon[0].map(coord => L.latLng(coord[1], coord[0])));
    const largestPolygon = polygons.reduce((largest, current) => {
      return calculateArea(current) > calculateArea(largest) ? current : largest;
    }, polygons[0]);
    return calculateCentroid(largestPolygon);
  }

  throw new Error(`Unsupported geometry type: ${type}`);
}

// Helper function to calculate the centroid of a set of LatLng points
function calculateCentroid(latLngs) {
  let area = 0;
  let centroidLat = 0;
  let centroidLng = 0;

  for (let i = 0, j = latLngs.length - 1; i < latLngs.length; j = i++) {
    const xi = latLngs[i].lng;
    const yi = latLngs[i].lat;
    const xj = latLngs[j].lng;
    const yj = latLngs[j].lat;

    const a = xi * yj - xj * yi;
    area += a;
    centroidLng += (xi + xj) * a;
    centroidLat += (yi + yj) * a;
  }

  area *= 0.5;
  centroidLng /= 6 * area;
  centroidLat /= 6 * area;

  return L.latLng(centroidLat, centroidLng);
}

// Helper function to calculate the area of a set of LatLng points
function calculateArea(latLngs) {
  let area = 0;

  for (let i = 0, j = latLngs.length - 1; i < latLngs.length; j = i++) {
    const xi = latLngs[i].lng;
    const yi = latLngs[i].lat;
    const xj = latLngs[j].lng;
    const yj = latLngs[j].lat;

    area += xi * yj - xj * yi;
  }

  return Math.abs(area / 2);
}

function createArrowSVG(color, size, rotation) {
  const svgNamespace = 'http://www.w3.org/2000/svg';

  // Create the SVG element
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('width', 50); // Adjust the width based on the arrow size
  svg.setAttribute('height', 50); // Adjust the height based on the arrow size
  svg.setAttribute('viewBox', '-50 -50 100 100'); // Center the arrow in the SVG canvas
  svg.style.overflow = 'visible'; // Ensure it’s not clipped

  // Rotate the SVG
  svg.style.transform = `rotate(${rotation}deg)`;
  svg.style.transformOrigin = 'center';

  // Create the line
  const line = document.createElementNS(svgNamespace, 'line');
  line.setAttribute('x1', '0'); // Start at the center
  line.setAttribute('y1', '0');
  line.setAttribute('x2', '0'); // Extend upwards
  line.setAttribute('y2', `${-size * 10}`); // Arrow size determines line length
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', 5);

  // Create the arrowhead (triangle)
  const arrowHead = document.createElementNS(svgNamespace, 'path');
  const headSize = 5  * 2; // Adjust the size of the arrowhead
  arrowHead.setAttribute(
    'd',
    `M 0,${-size * 10 - headSize * 2} L ${-headSize},${-size * 10} L ${headSize},${-size * 10} Z`
  );
  arrowHead.setAttribute('fill', color); // Arrowhead color matches the line

  // Append the line and arrowhead to the SVG
  svg.appendChild(line);
  svg.appendChild(arrowHead);

  return svg;
}
