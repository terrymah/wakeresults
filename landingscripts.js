function sortElections(elections) {
  return elections.sort((a, b) => {
    // Step 1: Compare years (descending order)
    if (a.year !== b.year) {
      return b.year - a.year; // Sort years in descending order
    }

    // Step 2: Compare scopes (federal > state > local > others)
    const scopePriority = { federal: 1, state: 2, local: 3, other: 4 };
    const scopeA = determineScope(a.tags, scopePriority);
    const scopeB = determineScope(b.tags, scopePriority);

    if (scopeA !== scopeB) {
      return scopeA - scopeB; // Lower priority number comes first
    }

    // Step 3: Elections without a "ref" tag come before those with one
    const hasRefA = a.ref ? 1 : 0; // 1 if "ref" tag exists, 0 otherwise
    const hasRefB = b.ref ? 1 : 0;

    if (hasRefA !== hasRefB) {
      return hasRefA - hasRefB; // Elections without "ref" come first
    }

    // Step 4: Alphabetical order by name (case-insensitive)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

// Determine the scope of an election and assign priority
function determineScope(tags, scopePriority) {
  if (tags.includes("federal")) return scopePriority.federal;
  if (tags.includes("state")) return scopePriority.state;
  if (tags.includes("local")) return scopePriority.local;
  return scopePriority.other; // Assign "other" priority if no scope tag is found
}

document.addEventListener("DOMContentLoaded", () => {
  const simpleModeContainer = document.getElementById("simple-mode");
  const advancedModeContainer = document.getElementById("advanced-mode");
  const filterOptions = document.querySelectorAll(".filter-option");
  const resultsTables = document.getElementById("results-tables");
  const candidateSelectContainer = document.getElementById("candidate-select-container");
  const candidateDropdown = document.getElementById("advanced-candidate-dropdown");
  const plusButton = document.getElementById("advanced-plus-button");
  const goButton = document.getElementById("advanced-go-button");

  const dropdown = document.getElementById("map-dropdown");
  const simpleGoButton = document.getElementById("go-button");
  const simpleLink = document.getElementById("simple-link");
  const advancedLink = document.getElementById("advanced-link");

  let electionObjects = [];
  let filteredElections = [];
  let selectedYear = "all";
  let selectedType = "all";
  let selectedCandidates = []; // Used for advanced mode candidate selection

  // Hardcoded mapping of party to color
  const partyColors = {
    DEM: "blue",
    REP: "red",
    GRE: "green",
    LIB: "yellow",
    UNA: "purple",
    default: "any"
  };

  let textFilter = ""; // Holds the current value of the text filter

    // Debounce function
  function debounce(func, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout); // Clear the previous timeout
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Add an event listener for the text filter with debounce
  const textFilterInput = document.getElementById("text-filter");
  textFilterInput.addEventListener(
    "input",
    debounce((e) => {
      textFilter = e.target.value.toLowerCase(); // Store the lowercase value of the text input
      applyFilters(); // Reapply filters with a delay
    }, 500) // 500ms delay
  );

  // Reset Button Logic
  const resetButton = document.getElementById("reset-button");

  resetButton.addEventListener("click", () => {
    // Reset all filters to "all"
    selectedYear = "all";
    selectedType = "all";
    textFilter = ""; // Clear the text filter
  
    // Clear the text filter input
    const textFilterInput = document.getElementById("text-filter");
    textFilterInput.value = "";
  
    // Reset active states on filter buttons
    document.querySelectorAll(".filter-option[data-type='year']").forEach(btn => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-filter") === "all") {
        btn.classList.add("active");
      }
    });
  
    document.querySelectorAll(".filter-option[data-type='type']").forEach(btn => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-filter") === "all") {
        btn.classList.add("active");
      }
    });
  
    // Reapply filters
    applyFilters();
  });
  
  const jsonFiles = [
    "2016.json",
    "2017.json",
    "2018.json",
    "2019.json",
    "2020.json",
    "2021.json",
    "2022.json",
    "2023.json",
    "maps.json",
    "2016d.json",
    "2017d.json",
    "2018d.json",
    "2019d.json",
    "2020d.json",
    "2021d.json",
    "2022d.json",
    "2023d.json"
  ];

  // Fetch and parse all JSON files
  Promise.all(jsonFiles.map(file => fetch(file).then(response => response.json())))
    .then(allData => {
      // Extract "contests" from each JSON file and merge into a single array
      electionObjects = allData.flatMap(data => data.contests);
      electionObjects = sortElections(electionObjects);
      filteredElections = [...electionObjects];
      initializeSimpleMode();
      initializeAdvancedMode();
      applyFilters();
      // Add event listeners for filter options
      filterOptions.forEach(option => {
        option.addEventListener("click", (e) => {
          const filterType = option.getAttribute("data-type");
          const filterValue = option.getAttribute("data-filter");

          // Update selected filters
          if (filterType === "year") {
            selectedYear = filterValue;
          } else if (filterType === "type") {
            selectedType = filterValue;
          }

          // Update active class
          document.querySelectorAll(`.filter-option[data-type="${filterType}"]`).forEach(opt => opt.classList.remove("active"));
          option.classList.add("active");

          // Apply filters to both modes
          applyFilters();
        });
      });
    })
    .catch(error => {
      console.error("Error loading JSON files:", error);
    });

  // Initialize Simple Mode
  function initializeSimpleMode() {
    //populateDropdown(filteredElections);
    //populateTables(filteredElections);

    // Enable "Go" button when a selection is made
    dropdown.addEventListener("change", () => {
      simpleGoButton.disabled = dropdown.value === "";
    });

    // Handle Simple Mode "Go" button
    simpleGoButton.addEventListener("click", () => {
      const selectedName = dropdown.value;
      if (selectedName) {
        const selectedElection = filteredElections.find(election => election.name === selectedName);
        if (selectedElection) {
          const url = constructURL(selectedElection);
          window.location.href = url;
        } else {
          console.error("Selected election not found!");
        }
      }
    });
  }

  // Apply filters
  function applyFilters() {
    filteredElections = electionObjects.filter(election => {
      const matchesYear = selectedYear === "all" || election.year == selectedYear;
      const matchesType = selectedType === "all" || election.tags.includes(selectedType);
      // Match election name or any candidate name with the text filter
      const matchesText = textFilter.length < 3 || 
        election.name.toLowerCase().includes(textFilter) || 
        election.candidates.some(candidate => candidate.name.toLowerCase().includes(textFilter));

      return matchesYear && matchesType && matchesText;
    });

    // Sort the filtered elections
    filteredElections = sortElections(filteredElections);

    populateDropdown(filteredElections);
    populateTables(filteredElections);

    // Update the Advanced Mode dropdown
    populateAdvancedDropdown(filteredElections);    
  }

  // Populate the dropdown with filtered elections
  function populateDropdown(objects) {
    dropdown.innerHTML = '<option value="">Select an election</option>';
    objects.forEach(obj => {
      const option = document.createElement("option");
      option.value = obj.name;
      option.textContent = `${obj.year} - ${obj.name}`;
      dropdown.appendChild(option);
    });
    dropdown.disabled = objects.length === 0;
    simpleGoButton.disabled = true;
  }

  // Populate the tables with filtered election results
  function populateTables(objects) {
    resultsTables.innerHTML = ""; // Clear previous tables
    objects.forEach(election => {
      const table = document.createElement("table");
      table.className = "results-table";

      // Add caption (title with hyperlink)
      const caption = document.createElement("caption");
      const captionLink = document.createElement("a");
      captionLink.href = constructURL(election);
      captionLink.textContent = `(${election.year}) ${election.name}`;
      captionLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = constructURL(election);
      });
      caption.appendChild(captionLink);
      table.appendChild(caption);

      // Add table headers
      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th>Name</th>
          <th>Party</th>
          <th>Votes</th>
          <th>Percent</th>
        </tr>
      `;
      table.appendChild(thead);

      // Add table body
      const tbody = document.createElement("tbody");

      // Determine the number of winners
      const pick = election.pick || 1; // Default to 1 if "pick" is not present

      // Filter out "over", "under", and "Write-In" candidates for winner determination
      const eligibleCandidates = election.candidates.filter(candidate => {
        const name = candidate.name.toLowerCase();
        return name !== "over" && name !== "under" && name !== "write-in";
      });

      // Find the winners: sort by votes and pick the top "pick" candidates
      const winners = eligibleCandidates
        .slice() // Create a shallow copy to avoid mutating the original array
        .sort((a, b) => b.votes - a.votes) // Sort by votes descending
        .slice(0, pick); // Get the top "pick" candidates
      
      // Sort candidates by percent (descending)
      const sortedCandidates = election.candidates.slice().sort((a, b) => {
        const percentA = a.percent || 0; // Default missing percent to 0
        const percentB = b.percent || 0;
        return percentB - percentA; // Descending order
      });
      
      sortedCandidates.forEach((candidate, index) => {
        const row = document.createElement("tr");

        // Apply party-based coloring if a party is present
        if (candidate.political_party) {
          row.classList.add(`party-${candidate.political_party.trim().toLowerCase()}`);
        } else {
          row.style.backgroundColor = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
        }

        // Determine if this candidate is one of the winners
        const winnerIndex = winners.findIndex(winner => winner.name === candidate.name);
        let trophy = ""; // Default: no trophy

        // Assign trophies based on position
        if (winnerIndex === 0) trophy = "🏆"; // Gold trophy for the top winner
        else if (winnerIndex === 1) trophy = "🥈"; // Silver trophy for second place
        else if (winnerIndex > 1) trophy = "🥉"; // Bronze trophy for third+ place

        row.innerHTML = `
          <td>${trophy ? `${trophy} <strong>${candidate.name}</strong>` : candidate.name}</td>
          <td>${candidate.political_party || ""}</td>
          <td>${candidate.votes ? candidate.votes.toLocaleString() : ""}</td>
          <td>${candidate.percent ? `${candidate.percent.toFixed(2)}%` : ""}</td>
        `;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);

      // Append table to the container
      resultsTables.appendChild(table);
    });
  }

  function populateAdvancedDropdown(elections) {
    // Clear the current dropdown options
    candidateDropdown.innerHTML = '<option value="">Select a candidate</option>';
  
    // Iterate through filtered elections
    elections.forEach(election => {
      // Check if the text filter matches the election name
      const matchesElectionName = election.name.toLowerCase().includes(textFilter);
  
      if (matchesElectionName) {
        // Add all candidates from the matching election
        election.candidates.forEach(candidate => {
          const option = document.createElement("option");
          option.value = JSON.stringify({ candidateName: candidate.name, electionYear: election.year, electionName: election.name });
          option.textContent = `${candidate.name} (${election.year} - ${election.name})`;
          candidateDropdown.appendChild(option);
        });
      } else {
        // If the text filter doesn't match the election name, check candidates
        election.candidates.forEach(candidate => {
          const matchesCandidateName = candidate.name.toLowerCase().includes(textFilter);
  
          if (matchesCandidateName) {
            const option = document.createElement("option");
            option.value = JSON.stringify({ candidateName: candidate.name, electionYear: election.year, electionName: election.name });
            option.textContent = `${candidate.name} (${election.year} - ${election.name})`;
            candidateDropdown.appendChild(option);
          }
        });
      }
    });
  
    // Disable the Plus button if no candidate is selected
    plusButton.disabled = true; // Reset Plus button state
    candidateDropdown.addEventListener("change", () => {
      plusButton.disabled = candidateDropdown.value === "";
    });
  }
  
  // Construct URL for Simple Mode
  function constructURL(selectedElection) {
    const file = "2024.geojson";
    const csv = selectedElection.candidates.map(candidate => candidate.csv || selectedElection.csv_file).join(",");
    const portion = selectedElection.candidates.map(candidate => candidate.column || candidate.name).join(",");
    const total = selectedElection.candidates.map(candidate => candidate.total).join(",");
    const color = selectedElection.candidates
      .map(candidate => partyColors[candidate.political_party] || partyColors.default)
      .join(",");
    const name = selectedElection.candidates.map(candidate => encodeURIComponent(candidate.name)).join(",");
    const title = encodeURIComponent(selectedElection.name) + ` (${selectedElection.year})`;

    return `map.html?file=${file}&csv=${csv}&portion=${portion}&total=${total}&color=${color}&name=${name}&title=${title}`;
  }

  // Initialize Advanced Mode
  function initializeAdvancedMode() {
    //applyFilters();

    // Handle "Plus" button click
    plusButton.addEventListener("click", () => {
      const selectedValue = JSON.parse(candidateDropdown.value);
      const { candidateName, electionYear, electionName } = selectedValue;
      // Find the election and candidate details from the JSON file
      const selectedElection = electionObjects.find(election => election.name === electionName && election.year === electionYear);
      const selectedCandidate = selectedElection.candidates.find(candidate => candidate.name === candidateName);
      // Add the full candidate details to the selectedCandidates array
      const calcName = `${selectedCandidate.name} (${electionYear})`;
      selectedCandidates.push({
        name: calcName,
        column: selectedCandidate.column || selectedCandidate.name,
        total: selectedCandidate.total,
        party: selectedCandidate.political_party,
        electionName: selectedElection.name,
        csv: selectedElection.csv_file
      });

      // Add a label for the selected candidate
      addCandidateLabel(calcName, electionYear, selectedElection.name);

      // Clear dropdown selection
      candidateDropdown.value = "";
      plusButton.disabled = true;
      updateGoButtonState();
    });

    // Handle "Go" button click
    goButton.addEventListener("click", () => {
      if (selectedCandidates.length < 2) return;

      // Construct URL parameters using the structured selectedCandidates data
      const file = "2024.geojson";
      const csv = selectedCandidates.map(candidate => candidate.csv).join(",");
      const portion = selectedCandidates.map(candidate => candidate.column).join(",");
      const total = selectedCandidates.map(candidate => candidate.total).join(",");
      const color = selectedCandidates.map(candidate => partyColors[candidate.political_party] || partyColors.default).join(",");
      const name = selectedCandidates.map(candidate => encodeURIComponent(candidate.name)).join(",");
      const title = selectedCandidates.map(candidate => encodeURIComponent(candidate.name)).join(" vs ");

      const url = `map.html?file=${file}&csv=${csv}&portion=${portion}&total=${total}&color=${color}&name=${name}&title=${title}`;
      window.location.href = url;
    });
  }

  // Populate the Advanced Mode dropdown
  function populateCandidateDropdown() {
    electionObjects.forEach(election => {
      election.candidates.forEach(candidate => {
        const option = document.createElement("option");
        option.value = JSON.stringify({ candidateName: candidate.name, electionYear: election.year, electionName: election.name });
        option.textContent = `${candidate.name} (${election.year} - ${election.name})`;
        candidateDropdown.appendChild(option);
      });
    });

    // Enable Plus button when candidate is selected
    candidateDropdown.addEventListener("change", () => {
      plusButton.disabled = candidateDropdown.value === "";
    });
  }

  // Add a candidate label with a "Minus" button
  function addCandidateLabel(candidateName, electionYear, electionName) {
    const labelDiv = document.createElement("div");
    labelDiv.className = "candidate-label";

    const label = document.createElement("span");
    label.textContent = `${candidateName} (${electionYear} - ${electionName})`;

    const minusButton = document.createElement("button");
    minusButton.textContent = "Remove";
    minusButton.className = "link-style";

    minusButton.addEventListener("click", () => {
      // Remove the candidate from the selectedCandidates array
      console.log(`name: ${candidateName} election: ${electionName}`);
      console.log(selectedCandidates);
      selectedCandidates = selectedCandidates.filter(
        candidate => !(candidate.name === candidateName && candidate.electionName === electionName)
      );
      labelDiv.remove();
      updateGoButtonState();
    });

    labelDiv.appendChild(label);
    labelDiv.appendChild(minusButton);
    candidateSelectContainer.appendChild(labelDiv); // Append to end of the list
  }

  // Update the Advanced Mode "Go" button state
  function updateGoButtonState() {
    goButton.disabled = selectedCandidates.length < 2;
  }

  // Switch between Simple and Advanced Mode
  simpleLink.addEventListener("click", (e) => {
    e.preventDefault();
    simpleModeContainer.style.display = "block";
    advancedModeContainer.style.display = "none";
    simpleLink.classList.add("active");
    advancedLink.classList.remove("active");
  });

  advancedLink.addEventListener("click", (e) => {
    e.preventDefault();
    simpleModeContainer.style.display = "none";
    advancedModeContainer.style.display = "block";
    simpleLink.classList.remove("active");
    advancedLink.classList.add("active");
  });
});
