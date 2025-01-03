// Define color scales

  const colorScales = [
    {
      name: "blue",
      base: "#004c6d",
      shades: [
        "#d1eef9", "#a5dbf4", "#69bbe3", "#369ac8", "#1c6f9d", "#004c6d", "#003348",
        "#002132", "#00131c", "#000a0d", 
      ],
    },
    {
      name: "red",
      base: "#8e0b0b",
      shades: [
        "#fac3c3", "#f59393", "#e85b5b", "#d72f2f", "#b31a1a", "#8e0b0b", "#5d0505",
        "#3c0202", "#220000", "#110000", 
      ],
    },
    {
      name: "green",
      base: "#1b7f27",
      shades: [
        "#c5efc2", "#96e394", "#4ebf5c", "#23a633", "#188a27", "#1b7f27", "#0b5118",
        "#04320e", "#001d05", "#001001", 
      ],
    },
    {
      name: "orange",
      base: "#d15c1e",
      shades: [
        "#fbdcc5", "#f6b693", "#ef8147", "#e5581a", "#c04612", "#d15c1e", "#84350b",
        "#4c1d06", "#261103", "#120902", 
      ],
    },
    {
      name: "purple",
      base: "#60298e",
      shades: [
        "#e3d1f7", "#c5a5ed", "#a869e0", "#8939d0", "#6c2ab5", "#60298e", "#482069",
        "#2c1340", "#170920", "#0a0410", 
      ],
    },
    {
      name: "yellow",
      base: "#d8b31f",
      shades: [
        "#fff5b5", "#ffec6b", "#ffdf23", "#f7c404", "#a1840d", "#d8b31f", "#604b07",
        "#362903", "#1d1601", "#0d0b00", 
      ],
    },
    {
      name: "pink",
      base: "#cc337d",
      shades: [
        "#f9c7dd", "#f399bb", "#ea5f90", "#db3472", "#b1265a", "#cc337d", "#822047",
        "#4c132a", "#270a16", "#13070b", 
      ],
    },
    {
      name: "teal",
      base: "#206d6b",
      shades: [
        "#c1eded", "#8bd6d6", "#47b8b7", "#239f9e", "#1d7c7c", "#206d6b", "#124847",
        "#082727", "#041515", "#020b0b", 
      ],
    },
    {
      name: "brown",
      base: "#7a5230",
      shades: [
        "#eedccc", "#e1bfa0", "#d19c6e", "#bb7642", "#8f5a2f", "#7a5230", "#4e341f",
        "#2e1f12", "#17100a", "#0a0805", 
      ],
    },
    {
      name: "gray",
      base: "#5c5c5c",
      shades: [
        "#ececec", "#c7c7c7", "#9a9a9a", "#757575", "#5c5c5c", "#3a3a3a", "#202020",
        "#111111", "#080808", "#030303", 
      ],
    },
  ];
  
  
  // Define bucket thresholds (hardcoded for now, ramping 1.5)
  const buckets = [
    { min: 0, max: 1.5 },
    { min: 1.5, max: 3 },
    { min: 3, max: 4.5 },
    { min: 4.5, max: 6 },
    { min: 6, max: 7.5 },
    { min: 7.5, max: 9 },
    { min: 9, max: 10.5 },
    { min: 10.5, max: 12 },
    { min: 12, max: 13.5 },
    { min: 13.5, max: Infinity },
  ];
  
  const assignedColors = {}; // Maps column names to color scales

  function initColors(colorPreferences, portionColumns) {
    const usedColors = new Set(); // Track colors that have already been assigned
  
    // First pass: Assign preferred colors if unused
    portionColumns.forEach((column, index) => {
      const preferredColor = colorPreferences[index];
      if (preferredColor && !usedColors.has(preferredColor)) {
        const colorScale = colorScales.find(scale => scale.name === preferredColor);
        if (colorScale) {
          assignedColors[column] = colorScale;
          usedColors.add(preferredColor);
        }
      }
    });
  
    // Second pass: Assign unused colors to columns without an assigned color
    portionColumns.forEach(column => {
      if (!assignedColors[column]) {
        const nextUnusedColor = colorScales.find(scale => !usedColors.has(scale.name));
        if (nextUnusedColor) {
          assignedColors[column] = nextUnusedColor;
          usedColors.add(nextUnusedColor.name);
        }
      }
    });
  
    
  }

  function getColorScaleForColumn(column) {
    return assignedColors[column] || null;
  }
  
  // Determine the bucket index for a given margin
  function getBucketIndex(margin) {
    return buckets.findIndex(bucket => margin >= bucket.min && margin < bucket.max);
  }
  
  // Get the color for a specific margin based on a column's assigned scale
  function getColorForMargin(margin, scale) {
    const bucketIndex = getBucketIndex(margin);
    return scale.shades[bucketIndex];
  }
  
  // Get gradient color for a single column (0-100%)
  function getGradientColor(value, scale) {
    const index = Math.floor((value / 100) * (scale.shades.length - 1));
    return scale.shades[index];
  }
  
  // Exported functions
  export { colorScales, initColors, getColorScaleForColumn, getColorForMargin, getGradientColor };
  