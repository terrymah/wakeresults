document.addEventListener("DOMContentLoaded", () => {
  const dropdown = document.getElementById("map-dropdown");
  const goButton = document.getElementById("go-button");
  const simpleLink = document.getElementById("simple-link");
  const advancedLink = document.getElementById("advanced-link");
  const filterOptions = document.querySelectorAll(".filter-option");
  const resultsTables = document.getElementById("results-tables");

  let electionObjects = [];
  let filteredElections = [];
  let selectedYear = "all";
  let selectedType = "all";

  // Hardcoded mapping of party to color
  const partyColors = {
    dem: "blue",
    rep: "red",
    green: "green",
    lib: "yellow",
    una: "purple",
    default: "any"
  };

  // Fetch and populate dropdown
  fetch("maps.json")
    .then(response => response.json())
    .then(data => {
      electionObjects = data;
      filteredElections = [...electionObjects];
      populateDropdown(filteredElections);
      populateTables(filteredElections);
    })
    .catch(error => {
      console.error("Error loading maps.json:", error);
    });

  // Populate dropdown with filtered election objects
  function populateDropdown(objects) {
    dropdown.innerHTML = '<option value="">Select an election</option>';
    objects.forEach(obj => {
      const option = document.createElement("option");
      option.value = obj.name;
      option.textContent = obj.name;
      dropdown.appendChild(option);
    });
    dropdown.disabled = objects.length === 0;
    goButton.disabled = true;
  }

  function populateTables(objects) {
    resultsTables.innerHTML = ""; // Clear previous tables
    objects.forEach(election => {
      const table = document.createElement("table");
      table.className = "results-table";
  
      // Add caption (title with hyperlink)
      const caption = document.createElement("caption");
      const captionLink = document.createElement("a");
      captionLink.href = constructURL(election);
      captionLink.textContent = election.name;
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
      election.candidates.forEach((candidate, index) => {
        const row = document.createElement("tr");
  
        // Apply party-based coloring if a party is present
        if (candidate.party) {
          row.classList.add(`party-${candidate.party}`);
        } else {
          // Alternate rows between white and gray if no party
          row.style.backgroundColor = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
        }
  
        row.innerHTML = `
          <td>${candidate.name}</td>
          <td>${candidate.party || ""}</td>
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
  
  // Apply filters and update dropdown and tables
  function applyFilters() {
    filteredElections = electionObjects.filter(election => {
      const matchesYear = selectedYear === "all" || election.tags.includes(selectedYear);
      const matchesType = selectedType === "all" || election.tags.includes(selectedType);
      return matchesYear && matchesType;
    });
    populateDropdown(filteredElections);
    populateTables(filteredElections);
  }

  // Handle filter clicks
  filterOptions.forEach(option => {
    option.addEventListener("click", (e) => {
      const filterType = option.getAttribute("data-type");
      const filterValue = option.getAttribute("data-filter");

      // Update selected filter
      if (filterType === "year") {
        selectedYear = filterValue;
      } else if (filterType === "type") {
        selectedType = filterValue;
      }

      // Update active class
      document.querySelectorAll(`.filter-option[data-type="${filterType}"]`).forEach(opt => opt.classList.remove("active"));
      option.classList.add("active");

      // Apply filters
      applyFilters();
    });
  });

  // Enable the Go button when a selection is made
  dropdown.addEventListener("change", () => {
    goButton.disabled = dropdown.value === "";
  });

  // Switch mode logic (currently only "Simple" active)
  simpleLink.addEventListener("click", (e) => {
    e.preventDefault();
    simpleLink.classList.add("active");
    advancedLink.classList.remove("active");
  });

  advancedLink.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Advanced mode is not yet implemented.");
  });

  // Construct URL based on the selected election
  function constructURL(selectedElection) {
    const file = "2024.geojson";
    const csv = selectedElection.candidates.map(candidate => candidate.csv || selectedElection.csv).join(",");
    const portion = selectedElection.candidates.map(candidate => candidate.column).join(",");
    const total = selectedElection.candidates.map(candidate => candidate.total).join(",");
    const color = selectedElection.candidates
      .map(candidate => partyColors[candidate.party] || partyColors.default)
      .join(",");
    const name = selectedElection.candidates.map(candidate => candidate.name).join(",");
    const title = encodeURIComponent(selectedElection.name);

    return `map.html?file=${file}&csv=${csv}&portion=${portion}&total=${total}&color=${color}&name=${name}&title=${title}`;
  }

  // Handle Go button click
  function handleGoAction() {
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
  }

  // Go button click event
  goButton.addEventListener("click", handleGoAction);

  // Handle "Enter" key press
  dropdown.addEventListener("keypress", (event) => {
    if (event.key === "Enter" && !goButton.disabled) {
      handleGoAction();
    }
  });
});
