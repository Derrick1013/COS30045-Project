// Set the dimensions and margins
const margin = { top: 40, right: 30, bottom: 60, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// Create SVG container
const svg = d3.select("#scatter-plot")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Create tooltip div
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Color scale
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

// Store the data globally
let rawData;
let selectedCountries = new Set();
let yearRange = { start: 2000, end: 2021 };
let showTrails = false;

// Load and process the data
d3.csv("./csv/OECD-Doctor-Graduates-Merged.csv").then(function (data) {
    rawData = data.map(d => ({
        country: d.Country,
        year: +d.Year,
        graduates: +d.Value_graduates,
        doctors: +d.Value_doctors
    })).filter(d => !isNaN(d.graduates) && !isNaN(d.doctors));

    // Set up year range
    const years = [...new Set(rawData.map(d => d.year))].sort();
    yearRange.start = years[0];
    yearRange.end = years[years.length - 1];

    // Set up year sliders
    setupYearSliders(years);

    // Initially select all countries
    selectedCountries = new Set(rawData.map(d => d.country));

    // Create checkboxes
    createCountryCheckboxes();

    // Initial plot
    updatePlot();
});

function setupYearSliders(years) {
    const startYearSlider = document.getElementById('start-year');
    const endYearSlider = document.getElementById('end-year');
    const startYearValue = document.getElementById('start-year-value');
    const endYearValue = document.getElementById('end-year-value');

    // Setup sliders
    startYearSlider.min = years[0];
    startYearSlider.max = years[years.length - 1];
    startYearSlider.value = years[0];
    endYearSlider.min = years[0];
    endYearSlider.max = years[years.length - 1];
    endYearSlider.value = years[years.length - 1];

    // Update displayed values
    startYearValue.textContent = startYearSlider.value;
    endYearValue.textContent = endYearSlider.value;

    // Add event listeners
    startYearSlider.addEventListener('input', function () {
        startYearValue.textContent = this.value;
        yearRange.start = +this.value;
        if (+endYearSlider.value < +this.value) {
            endYearSlider.value = this.value;
            endYearValue.textContent = this.value;
            yearRange.end = +this.value;
        }
        updatePlot();
    });

    endYearSlider.addEventListener('input', function () {
        endYearValue.textContent = this.value;
        yearRange.end = +this.value;
        if (+startYearSlider.value > +this.value) {
            startYearSlider.value = this.value;
            startYearValue.textContent = this.value;
            yearRange.start = +this.value;
        }
        updatePlot();
    });

    // Add trails checkbox listener
    document.getElementById('show-trails').addEventListener('change', function () {
        showTrails = this.checked;
        updatePlot();
    });
}

function createCountryCheckboxes() {
    const container = d3.select("#country-checkboxes");
    const countries = [...new Set(rawData.map(d => d.country))];

    countries.forEach(country => {
        const checkboxContainer = container.append("div")
            .attr("class", "checkbox-container");

        checkboxContainer.append("div")
            .attr("class", "color-indicator")
            .style("background-color", colorScale(country));

        checkboxContainer.append("label")
            .html(`<input type="checkbox" value="${country}" checked> ${country}`);
    });

    // Add event listeners
    container.selectAll("input")
        .on("change", function () {
            const country = this.value;
            if (this.checked) {
                selectedCountries.add(country);
            } else {
                selectedCountries.delete(country);
            }
            updatePlot();
        });

    // Select/Clear all buttons
    d3.select("#select-all-countries").on("click", () => {
        container.selectAll("input").property("checked", true);
        selectedCountries = new Set(countries);
        updatePlot();
    });

    d3.select("#clear-all-countries").on("click", () => {
        container.selectAll("input").property("checked", false);
        selectedCountries.clear();
        updatePlot();
    });
}

function updatePlot() {
    // Filter data based on selected countries and years
    const filteredData = rawData.filter(d =>
        selectedCountries.has(d.country) &&
        d.year >= yearRange.start &&
        d.year <= yearRange.end
    );

    // Update scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(rawData, d => d.graduates)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(rawData, d => d.doctors)])
        .range([height, 0]);

    // Remove existing elements
    svg.selectAll(".axis").remove();
    svg.selectAll(".point").remove();
    svg.selectAll(".trail").remove();
    svg.selectAll(".axis-label").remove();
    svg.selectAll(".title").remove();

    // Add X axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Medical Graduates per 100,000 Population");

    // Add Y axis
    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("x", -height / 2)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Practicing Physicians per 1,000 Population");

    // Add trails if enabled
    if (showTrails) {
        const lineGenerator = d3.line()
            .x(d => xScale(d.graduates))
            .y(d => yScale(d.doctors));

        const groupedData = d3.group(filteredData, d => d.country);

        groupedData.forEach((countryData, country) => {
            const sortedData = countryData.sort((a, b) => a.year - b.year);

            const path = svg.append("path")
                .datum(sortedData)
                .attr("class", "trail")
                .attr("d", lineGenerator)
                .style("stroke", colorScale(country))
                .style("fill", "none")
                .style("opacity", 0.3)
                .style("stroke-width", 1);

            // Get the total length of the path
            const totalLength = path.node().getTotalLength();

            // Animate the path
            path
                .attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .duration(2000)  // Adjust duration as needed
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0);

            // Add hover effect
            path
                .on("mouseover", function () {
                    d3.select(this)
                        .style("opacity", 0.8)
                        .style("stroke-width", 2);
                })
                .on("mouseout", function () {
                    d3.select(this)
                        .style("opacity", 0.3)
                        .style("stroke-width", 1);
                });
        });
    }

    // Add scatter plot points
    svg.selectAll("circle")
        .data(filteredData)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d.graduates))
        .attr("cy", d => yScale(d.doctors))
        .attr("r", 5)
        .style("fill", d => colorScale(d.country))
        .style("opacity", 0.7)
        .on("mouseover", function (event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 8)
                .style("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);

            tooltip.html(`${d.country}<br/>
                Year: ${d.year}<br/>
                Graduates: ${d.graduates.toFixed(2)}<br/>
                Doctors: ${d.doctors.toFixed(2)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 5)
                .style("opacity", 0.7);

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Add title
    svg.append("text")
        .attr("class", "title")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text(`Medical Graduates vs Active Physicians (${yearRange.start}-${yearRange.end})`);
}
