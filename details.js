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

    // Step 1: Find overall winner and second place across all precincts
    let totalCandidateValues = {}; // Stores either raw vote counts or percentages

    Object.values(precinctData).forEach(data => {
        enabledPortionColumns.forEach(column => {
            const portionValue = parseFloat(data[column]) || 0;
            const totalValue = parseFloat(data[totalColumns[portionColumns.indexOf(column)]]) || 1;
            const calculatedValue = isAbsoluteMode ? portionValue : (portionValue / totalValue) * 100;

            if (!totalCandidateValues[column]) {
                totalCandidateValues[column] = 0;
            }
            totalCandidateValues[column] += calculatedValue;
        });
    });

    // Sort candidates by total votes to determine overall winner & runner-up
    const sortedCandidates = Object.entries(totalCandidateValues)
        .sort((a, b) => b[1] - a[1]);

    const overallWinner = sortedCandidates[0] ? sortedCandidates[0][0] : null;
    const overallSecondPlace = sortedCandidates[1] ? sortedCandidates[1][0] : null;
    console.log("Overall Winner:", overallWinner);
    console.log("Overall Second Place:", overallSecondPlace);
    // Step 2: Transform precinctData into table format
    const tableData = Object.entries(precinctData).map(([precinct, data]) => {
        let row = { Precinct: precinct };

        enabledPortionColumns.forEach((column, index) => {
            const portionValue = parseFloat(data[column]) || 0;
            const totalValue = parseFloat(data[totalColumns[portionColumns.indexOf(column)]]) || 1;
            const value = isAbsoluteMode ? portionValue : (portionValue / totalValue) * 100;

            const safeFieldName = (enabledFriendlyNames[index] || column).replace(/\./g, "_");
            row[safeFieldName] = isAbsoluteMode ? value.toFixed(0) : value.toFixed(2) + "%";
        });

        // Step 3: Calculate the margin using the overall top two candidates
        if (overallWinner && overallSecondPlace) {
            const winnerPortion = parseFloat(data[overallWinner]) || 0;
            const secondPlacePortion = parseFloat(data[overallSecondPlace]) || 0;
            const winnerTotal = parseFloat(data[totalColumns[portionColumns.indexOf(overallWinner)]]) || 1;
            const secondPlaceTotal = parseFloat(data[totalColumns[portionColumns.indexOf(overallSecondPlace)]]) || 1;

            let marginValue;
            if (isAbsoluteMode) {
                marginValue = winnerPortion - secondPlacePortion;
            } else {
                const winnerPercent = (winnerPortion / winnerTotal) * 100;
                const secondPlacePercent = (secondPlacePortion / secondPlaceTotal) * 100;
                marginValue = winnerPercent - secondPlacePercent;
            }

            row["Margin"] = isAbsoluteMode ? marginValue.toFixed(0) : marginValue.toFixed(2) + "%";
        } else {
            row["Margin"] = "N/A";
        }

        return row;
    });

    // Clear previous table before rendering
    document.getElementById("results-table").innerHTML = "";

    // Create the Tabulator table
    const table = new Tabulator("#results-table", {
        data: tableData,
        layout: "fitColumns",
        columns: [
            { title: "Precinct", field: "Precinct" }
        ].concat(enabledPortionColumns.map((column, index) => ({
            title: enabledFriendlyNames[index] || column,
            field: (enabledFriendlyNames[index] || column).replace(/\./g, "_"),
            sorter: "number"
        })))
        .concat([
            { title: "Margin", field: "Margin", sorter: "number", cssClass: "italic-column" }
        ]),
    });

    // Show the overlay only AFTER the table has fully loaded data
    table.on("dataLoaded", function () {
        overlay.style.display = "flex";
    });   
}