import { precinctData, isAbsoluteMode, portionColumns, totalColumns, friendlyNames, enabledColumns } from './script.js';

document.addEventListener("DOMContentLoaded", () => {
    createTableOverlay();
});

function createTableOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "table-overlay";
    overlay.style.display = "none"; // Initially hidden

    overlay.innerHTML = `
        <div id="table-container">
            <button id="close-table">&times;</button>
            <div id="table-wrapper"> <!-- New wrapper for scrolling -->
                <div id="results-table"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close on ESC key
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            overlay.style.display = "none";
        }
    });

    // Close button event
    document.getElementById("close-table").addEventListener("click", () => {
        overlay.style.display = "none";
    });
}

export function showResultsTable() {
    const overlay = document.getElementById("table-overlay");

    // Filter enabled candidates
    const enabledPortionColumns = portionColumns.filter(col => enabledColumns[col]);
    const enabledFriendlyNames = friendlyNames.filter((_, index) => enabledColumns[portionColumns[index]]);

    // Transform precinctData into table format
    const tableData = Object.entries(precinctData).map(([precinct, data]) => {
        let row = { Precinct: precinct };
        let candidateValues = [];

        enabledPortionColumns.forEach((column, index) => {
            const portionValue = parseFloat(data[column]) || 0;
            const totalValue = parseFloat(data[totalColumns[portionColumns.indexOf(column)]]) || 1;
            const value = isAbsoluteMode ? portionValue : (portionValue / totalValue) * 100;

            // Replace periods in field names for Tabulator
            const safeFieldName = (enabledFriendlyNames[index] || column).replace(/\./g, "_");
            row[safeFieldName] = isAbsoluteMode ? value.toFixed(0) : value.toFixed(2) + "%";

            // Store values for margin calculation
            candidateValues.push({ name: safeFieldName, value });
        });

        // Sort candidates by value (descending) to determine margin
        candidateValues.sort((a, b) => b.value - a.value);

        if (candidateValues.length >= 2) {
            let marginValue = candidateValues[0].value - candidateValues[1].value;
            row["Margin"] = isAbsoluteMode ? marginValue.toFixed(0) : marginValue.toFixed(2) + "%";
        } else {
            row["Margin"] = "N/A"; // If only one candidate has data
        }

        return row;
    });

    // Clear previous table before rendering new one
    document.getElementById("results-table").innerHTML = "";

    const table = new Tabulator("#results-table", {
        data: tableData,
        layout: "fitColumns",
        columns: [
            { title: "Precinct", field: "Precinct" }
        ]
        .concat(enabledPortionColumns.map((column, index) => ({
            title: enabledFriendlyNames[index] || column,  // Use friendly name if available
            field: (enabledFriendlyNames[index] || column).replace(/\./g, "_"), // Ensure consistency
            sorter: "number"
        })))
        .concat([
            { 
                title: "Margin", 
                field: "Margin", 
                sorter: "number", 
                cssClass: "italic-column" // Apply CSS class
            }
        ]),    
    });

    // Show the overlay only AFTER the table has fully loaded data
    table.on("dataLoaded", function () {
        overlay.style.display = "flex";
    });   
}

