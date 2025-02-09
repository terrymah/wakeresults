  const colorScales = [
    {
      name: "blue",
      base: "#00aed6",
      shades: ["#d6e6ff","#c6d6ff","#b6c6ff","#a6b6ff","#96a6ff","#8696ff","#7686ff","#6676ff","#5666ee","#4656dd","#3646cc","#2636bb","#1626aa","#101699","#000088"],
    },
    {
      name: "red",
      base: "#a50f15",
      shades: ["#ffe6d9","#ffcfc6","#ffb9b3","#ffa9a3","#ff9993","#ff8983","#ff7773","#f36663","#ee554c","#dd4943","#cc3933","#b92923","#a01913","#990903","#800000"],
    },
    {
      name: "green",
      base: "#006d2c",
      shades: ["#eeffd3","#ddffc3","#ccffb3","#bbf3a0","#aae986","#99dd76","#88cc66","#77bb55","#66aa44","#559933","#448822","#337711","#226c10","#115c0c","#005000"],
    },
    {
      name: "orange",
      base: "#d15c1e",
      shades: ["#fff3dd","#ffeebb","#ffe3a0","#ffd680","#ffc966","#fab644","#f9a333","#f39022","#ee8811","#dd7700","#c36900","#ac5c00","#9c4c00","#7c4300","#663300"],
    },
    {
      name: "purple",
      base: "#60298e",
      shades: ["#f9d9ff","#e6bbff","#d3aaff","#c399ff","#b388ff","#a977ff","#a366ff","#9355ff","#8044ff","#7333ee","#6622dd","#5511cc","#4409aa","#330699","#220077"],
    },
    {
      name: "yellow",
      base: "#d8b31f",
      shades: ["#ffffdd","#ffffcc","#fffaaa","#fef688","#f6f066","#eee344","#e3d933","#ddd022","#d3c311","#d0b909","#b9a000","#9c9000","#898000","#736c00","#555000"],
    },
    {
      name: "gray",
      base: "#5c5c5c",
      shades: ["#eeeeee","#dddddd","#cccccc","#bbbbbb","#aaaaaa","#999999","#888888","#777777","#666666","#555555","#444444","#333333","#222222","#111111","#000000"],
    },
  ];
  
  
  // Define bucket thresholds
  const buckets = [
    { min: 0, max: 1 },
    { min: 1, max: 2 },
    { min: 2, max: 3 },
    { min: 3, max: 4 },
    { min: 4, max: 5 },
    { min: 5, max: 6 },
    { min: 6, max: 7 },
    { min: 7, max: 8 },
    { min: 8, max: 9 },
    { min: 9, max: 10 },
    { min: 10, max: 11 },
    { min: 11, max: 12 },
    { min: 12, max: 13 },
    { min: 13, max: 14 },    
    { min: 14, max: Infinity },        
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
  
    // Third pass: You get gray
    portionColumns.forEach(column => {
      if (!assignedColors[column]) {
        const grayColor = colorScales.find(scale => scale.name === "gray");
        assignedColors[column] = grayColor;
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
  