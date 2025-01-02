import { loadGeoJson, styleFeature, onEachFeature } from './mapUtils.js';
import { initColors, getColorScaleForColumn } from './colorScale.js';

let precinctData = {};

// Precinct splits
const precinctSplits = {
  "03-00": ["03-01", "03-02"],
  "06-09": ["06-11", "06-12"],
  "10-04": ["10-05", "10-06"],
  "12-05": ["12-10", "12-11"],
  "17-04": ["17-14", "17-15"],
  "19-12": ["19-22", "19-23"]
};

// Query parameters and default values
function getQueryParam(param, defaultValue) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param) || defaultValue;
}

function calculateTotals(precinctData, portionColumns, totalColumns) {
  const totals = {};

  portionColumns.forEach((portionColumn, index) => {
    const totalColumn = totalColumns[index]; // Get the corresponding "all"/total column
    let totalPortion = 0;
    let totalAll = 0;

    Object.values(precinctData).forEach(row => {
      const portionValue = parseFloat(row[portionColumn]) || 0;
      const allValue = parseFloat(row[totalColumn]) || 0; // Use dynamic total column

      totalPortion += portionValue;
      totalAll += allValue;
    });

    const percentage = totalAll > 0 ? (totalPortion / totalAll) * 100 : 0;
    totals[portionColumn] = {
      totalPortion: totalPortion.toFixed(2),
      totalAll: totalAll.toFixed(2),
      percentage: percentage.toFixed(2)
    };
  });

  return totals;
}

async function calculatePrecinctData(csvFiles, portionColumns, totalColumns) {
  const precinctData = {};
  const precinctPresence = {}; // To track precincts across files
  const uniqueCsvFiles = [...new Set(csvFiles)]; // Get unique files

  const fileData = {}; // Temporary storage for each file's processed data

  // Process each unique file only once
  for (const csvFile of uniqueCsvFiles) {
    const csvFileUrl = `data/${csvFile}`;
    const response = await fetch(csvFileUrl);
    if (!response.ok) {
      throw new Error(`Failed to load CSV file: ${csvFile}: ${response.statusText}`);
    }

    const csvText = await response.text();
    const parsedData = {};

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        results.data.forEach(row => {
          const precinctId = row["id"];
          if (!precinctId) return; // Skip rows without an ID

          // Handle split precincts
          if (precinctSplits[precinctId]) {
            const splitPrecincts = precinctSplits[precinctId];
            const numSplits = splitPrecincts.length;

            splitPrecincts.forEach(splitPrecinct => {
              if (!parsedData[splitPrecinct]) {
                parsedData[splitPrecinct] = { id: splitPrecinct };
              }

              // Distribute data evenly across split precincts
              Object.keys(row).forEach(key => {
                if (key === "id") return; // Skip the ID column
                const columnName = `${key}_${csvFile}`;
                const value = parseFloat(row[key]) || 0;

                if (!parsedData[splitPrecinct][columnName]) {
                  parsedData[splitPrecinct][columnName] = 0;
                }
                parsedData[splitPrecinct][columnName] += value / numSplits;
              });

              // Calculate the "all" column for the split precinct
              const allColumnName = `all_${csvFile}`;
              const allTotal = Object.keys(row)
                .filter(key => key !== "id" && key !== "under" && key !== "over") // Exclude "id" and "under"
                .reduce((sum, key) => {
                  const value = parseFloat(row[key]) || 0;
                  return sum + value / numSplits;
                }, 0);

              parsedData[splitPrecinct][allColumnName] = allTotal;
            });
          } else {
            // Handle normal (non-split) precinct
            if (!parsedData[precinctId]) {
              parsedData[precinctId] = { id: precinctId };
            }

            Object.keys(row).forEach(key => {
              if (key === "id") return; // Skip the ID column
              const columnName = `${key}_${csvFile}`;
              parsedData[precinctId][columnName] = parseFloat(row[key]) || 0;
            });

            // Calculate the "all" column for this file
            const allColumnName = `all_${csvFile}`;
            const allTotal = Object.keys(row)
              .filter(key => key !== "id" && key !== "under") // Exclude "id" and "under"
              .reduce((sum, key) => {
                const value = parseFloat(row[key]) || 0;
                return sum + value;
              }, 0);
            parsedData[precinctId][allColumnName] = allTotal;
          }
        });
      }
    });

    // Store the processed data for this file
    fileData[csvFile] = parsedData;

    // Track precinct presence for filtering
    Object.keys(parsedData).forEach(precinctId => {
      if (!precinctPresence[precinctId]) {
        precinctPresence[precinctId] = 0;
      }
      precinctPresence[precinctId] += 1;
    });
  }

  // Filter precincts to only include those present in all files
  const requiredFileCount = uniqueCsvFiles.length;
  Object.keys(precinctPresence).forEach(precinctId => {
    if (precinctPresence[precinctId] === requiredFileCount) {
      precinctData[precinctId] = { id: precinctId }; // Initialize row in merged data
    }
  });

  // Merge columns from all files into precinctData
  csvFiles.forEach((csvFile, index) => {
    const filePrecinctData = fileData[csvFile]; // Get processed data for this file
    const portionColumnWithSuffix = `${portionColumns[index]}_${csvFile}`;
    const totalColumnWithSuffix = `${totalColumns[index]}_${csvFile}`;
    const allColumnWithSuffix = `all_${csvFile}`;

    Object.keys(precinctData).forEach(precinctId => {
      const fileRow = filePrecinctData[precinctId];

      // Copy only the specific portion column for this file
      if (fileRow[portionColumnWithSuffix] !== undefined) {
        precinctData[precinctId][portionColumnWithSuffix] = fileRow[portionColumnWithSuffix];
      }

      // Copy only the specific total column for this file
      if (fileRow[totalColumnWithSuffix] !== undefined) {
        precinctData[precinctId][totalColumnWithSuffix] = fileRow[totalColumnWithSuffix];
      }

      // Copy the "all" column for this file
      if (fileRow[allColumnWithSuffix] !== undefined) {
        precinctData[precinctId][allColumnWithSuffix] = fileRow[allColumnWithSuffix];
      }
    });
  });

  return precinctData;
}

const geoJsonFileName = getQueryParam('file', '2024.geojson');
const csvFileNames = getQueryParam('csv', 'demoturnout2024.csv,demoturnout2024.csv').split(',');
const portionColumns = getQueryParam('portion', 'party_DEM_voted,party_REP_voted').split(',');
const totalColumns = getQueryParam('total', 'party_DEM,party_REP').split(',');
const friendlyNames = getQueryParam('name', 'Democrat,Republican').split(',');
const colorPreferences = getQueryParam('color', 'blue,red').split(',');

const showLabels = getQueryParam('labels', 'no') === 'yes';
const showTitle = getQueryParam('showTitle', 'yes') === 'yes';
const title = getQueryParam('title');

const showKey = getQueryParam('key', 'yes') === 'yes';
const absoluteModeOn = getQueryParam('absoluteMode', 'no') === 'yes';
let styleMode = getQueryParam('styleMode', 'gradient');

const mapEnabled = getQueryParam('showMap', 'yes') === 'yes';

// Validate that the lengths match
if (portionColumns.length !== totalColumns.length || portionColumns.length !== friendlyNames.length) {
  alert('The number of portion, total, and name columns must match.');
  throw new Error('Mismatched portion, total, and name arrays.');
}

if (portionColumns.length !== csvFileNames.length) {
  alert('The number of portion columns must match the number of csvFiles.');
  throw new Error('Mismatched portion and total columns.');
}

const geoJsonFileUrl = `shapes/${geoJsonFileName}`;

const enabledColumns = {};

// DOM Elements
const titleElement = document.getElementById('title');
const keyElement = document.getElementById('key');
const toggleLabelsCheckbox = document.getElementById('toggleLabels');
const toggleTitleCheckbox = document.getElementById('toggleTitle');
const toggleKeyCheckbox = document.getElementById('toggleKey');
const absoluteModeCheckbox = document.getElementById('absoluteMode');
const toggleMapCheckbox = document.getElementById('toggleMap');
const styleOptions = document.getElementsByName('styleMode');

// Set initial visibility based on arguments
toggleLabelsCheckbox.checked = showLabels;

titleElement.style.display = showTitle ? 'block' : 'none';
toggleTitleCheckbox.checked = showTitle;

keyElement.style.display = showKey ? 'block' : 'none';
toggleKeyCheckbox.checked = showKey;

titleElement.style.display = showTitle ? 'block' : 'none';
toggleTitleCheckbox.checked = showTitle;
titleElement.innerText = title;

absoluteModeCheckbox.checked = absoluteModeOn;

toggleMapCheckbox.checked = mapEnabled;

// Map Initialization
let backgroundLayer;
const map = L.map('map');
const arrowLayerGroup = L.layerGroup();
arrowLayerGroup.addTo(map);

backgroundLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
}).addTo(map); // Add the layer to the map initially

// Set the initial visibility of the background map layer
if (!mapEnabled) {
  map.removeLayer(backgroundLayer); // Remove the layer if the parameter is "no"
}

const labelMarkers = [];

// Checkbox event listeners
styleOptions.forEach(radio => {
  if (radio.value === styleMode) {
    radio.checked = true;
  } else {
    radio.checked = false;
  }

  radio.addEventListener('change', event => {
    styleMode = event.target.value; // Update the mode
    if (styleMode !== 'winnerTakeAll') {
      absoluteModeCheckbox.checked = false;
    }
    reloadMap(precinctData); // Reload the map to apply the new mode
  });
});  

absoluteModeCheckbox.addEventListener('change', () => {
  if (absoluteModeCheckbox.checked) {
    // Checkbox event listeners
    styleOptions.forEach(radio => {
      if (radio.value === 'winnerTakeAll') {
        radio.checked = true;
      } else {
        radio.checked = false;
      }
    });  
    styleMode = 'winnerTakeAll';
  }
  reloadMap(precinctData);
});

toggleLabelsCheckbox.addEventListener('change', () => {
  labelMarkers.forEach(marker => {
    if (toggleLabelsCheckbox.checked) {
      map.addLayer(marker);
    } else {
      map.removeLayer(marker);
    }
  });
});

toggleTitleCheckbox.addEventListener('change', () => {
  titleElement.style.display = toggleTitleCheckbox.checked ? 'block' : 'none';
});

toggleKeyCheckbox.addEventListener('change', () => {
  keyElement.style.display = toggleKeyCheckbox.checked ? 'block' : 'none';
});

toggleMapCheckbox.addEventListener('change', () => {
  if (toggleMapCheckbox.checked) {
    // Add the background layer back to the map
    backgroundLayer.addTo(map);
  } else {
    // Remove the background layer from the map
    map.removeLayer(backgroundLayer);
  }
});

const friendlyNameMap = {}; // Map column names to friendly names

(async function initializePage() {
  try {
    // Calculate precinctData and store globally
    precinctData = await calculatePrecinctData(csvFileNames, portionColumns, totalColumns);

    // Add suffixes to portionColumns and totalColumns
    portionColumns.forEach((col, index) => {
      portionColumns[index] = `${col}_${csvFileNames[index]}`;
      friendlyNameMap[portionColumns[index]] = friendlyNames[index]; // Map friendly name
    });
    totalColumns.forEach((col, index) => {
      totalColumns[index] = `${col}_${csvFileNames[index]}`;
    });

    portionColumns.forEach(column => {
      enabledColumns[column] = true;
    });

    // Initialize colors based on preferences
    initColors(colorPreferences, portionColumns);
    
    // Initialize the map with the preprocessed precinctData
    reloadMap(precinctData);
  } catch (error) {
    alert(`Error initializing page: ${error.message}`);
    console.error(error);
  }
})();

// Key creation
function createKey(totals, absoluteMode) {
  keyElement.innerHTML = '';

  portionColumns.forEach((column, index) => {
    const scale = getColorScaleForColumn(column);

    const keyRow = document.createElement('div');
    keyRow.className = 'key-row';
    keyRow.style.cursor = 'pointer';

    if (!enabledColumns[column]) {
      keyRow.style.textDecoration = 'line-through';
    }

    const colorBox = document.createElement('div');
    colorBox.className = 'key-color';
    colorBox.style.backgroundColor = scale.base;

    const label = document.createElement('span');
    const columnTotals = totals[column];

    // Dynamically display based on absolute mode
    if (absoluteMode) {
      label.innerHTML = `${friendlyNameMap[column] || column}: ${Math.round(columnTotals.totalPortion)}`;
    } else {
      label.innerHTML = `${friendlyNameMap[column] || column}: ${columnTotals.percentage}%`;
    }

    keyRow.appendChild(colorBox);
    keyRow.appendChild(label);
    keyElement.appendChild(keyRow);

    keyRow.addEventListener('click', () => {
      enabledColumns[column] = !enabledColumns[column];
      createKey(totals, absoluteModeCheckbox.checked); // Recreate key with updated state
      reloadMap(precinctData);
    });
  });
}

function reloadMap(precinctData) {
  // Remove all existing layers
  map.eachLayer(layer => {
    if (layer instanceof L.GeoJSON) {
      map.removeLayer(layer);
    }
  });

  arrowLayerGroup.clearLayers();

  // Clear label markers
  labelMarkers.forEach(marker => map.removeLayer(marker));
  labelMarkers.length = 0;

  // Recalculate totals and recreate the key
  const totals = calculateTotals(precinctData, portionColumns, totalColumns);
  createKey(totals, absoluteModeCheckbox.checked);

  // Reload GeoJSON with updated data
  loadGeoJson(
    map,
    geoJsonFileUrl,
    precinctData,
    (feature, data) =>
      styleFeature(
        feature,
        data,
        enabledColumns,
        portionColumns,
        totalColumns,
        absoluteModeCheckbox.checked,
        styleMode,
        map,
        arrowLayerGroup
      ),
    (feature, layer) =>
      onEachFeature(
        feature,
        layer,
        precinctData,
        portionColumns,
        totalColumns,
        absoluteModeCheckbox.checked,
        enabledColumns,
        labelMarkers,
        toggleLabelsCheckbox,
        friendlyNameMap,
        map
      )
  );
}

