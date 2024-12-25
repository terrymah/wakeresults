import { getColorScaleForColumn, initColors, getColorForMargin, getGradientColor } from './colorScale.js';

export function initializeMap(containerId) {
  const map = L.map(containerId);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  return map;
}

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
    })
    .catch(error => alert(`Error loading GeoJSON file: ${error.message}`));
}

export function styleFeature(feature, precinctData, enabledColumns, portionColumns, totalColumns, absoluteMode, winnerTakeAll) {
  const precinctId = feature.properties.PRECINCT;
  const precinctRow = precinctData[precinctId];
  if (!precinctRow) {
    return {
      fillColor: '#cccccc',
      weight: 1,
      opacity: 1,
      color: 'black',
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
      color: 'black',
      fillOpacity: 0.5
    };
  }

  values.sort((a, b) => b.value - a.value);

  if (winnerTakeAll) {
    const scale = getColorScaleForColumn(values[0].column);
    const fillColor = scale.base;
    return {
      fillColor,
      weight: 1,
      opacity: 1,
      color: 'black',
      fillOpacity: 0.7
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
      color: 'black',
      fillOpacity: 0.7
    };
  }

  const scale = getColorScaleForColumn(values[0].column);
  const fillColor = getGradientColor(values[0].value, scale);
  return {
    fillColor,
    weight: 1,
    opacity: 1,
    color: 'black',
    fillOpacity: 0.7
  };
}

export function onEachFeature(feature, layer, precinctData, portionColumns, totalColumns, absoluteMode, enabledColumns, labelMarkers, toggleLabelsCheckbox, friendlyNameMap) {
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
    labelMarker.addTo(map);
  }
}
