// Set the dimensions and margins
const margin = { top: 50, right: 80, bottom: 50, left: 80 };
const width = 600 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
const radius = Math.min(width, height) / 2;

// Create SVG container
const svg = d3.select("#radar-chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

// Create tooltip div
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Color scale
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

// Store the data globally
let rawData;
let selectedCountries = new Set();
let currentYear = 2000;

// Define metrics for the radar chart
const metrics = ["Dentists", "Midwifes", "Nurses", "Pharmacists", "Physicians"];

// Define transition duration
const transitionDuration = 350;

// Load and process the data
d3.csv("./csv/OECD-Detailed-Graduates.csv").then(function (data) {
    rawData = data.map(d => ({
        country: d.Country,
        year: +d.Year,
        values: metrics.map(metric => ({
            axis: metric,
            value: +d[metric] || 0
        })).filter(v => !isNaN(v.value))
    })).filter(d => d.values.length === metrics.length);

    // Setup controls
    setupControls();

    // Initially select all countries
    selectedCountries = new Set(rawData.map(d => d.country));

    // Create checkboxes
    createCountryCheckboxes();

    // Initial plot
    updateRadarChart();
});

function setupControls() {
    const years = [...new Set(rawData.map(d => d.year))].sort();
    const slider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-value');

    slider.min = years[0];
    slider.max = years[years.length - 1];
    slider.value = currentYear;
    yearDisplay.textContent = currentYear;

    slider.addEventListener('input', function () {
        currentYear = +this.value;
        yearDisplay.textContent = currentYear;
        updateRadarChart();
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
            updateRadarChart();
        });

    // Select/Clear all buttons
    d3.select("#select-all-countries").on("click", () => {
        container.selectAll("input").property("checked", true);
        selectedCountries = new Set(countries);
        updateRadarChart();
    });

    d3.select("#clear-all-countries").on("click", () => {
        container.selectAll("input").property("checked", false);
        selectedCountries.clear();
        updateRadarChart();
    });
}


function updateRadarChart() {
    // Filter data for selected year and countries
    const filteredData = rawData.filter(d =>
        d.year === currentYear &&
        selectedCountries.has(d.country)
    );

    // Calculate max value for scaling based on filtered data
    const maxValue = d3.max(filteredData, d =>
        d3.max(d.values, v => v.value)
    ) || 1;  // Fallback to 1 to avoid zero scale

    // Determine which axes have data for the selected year and countries
    const axesWithData = new Set();
    filteredData.forEach(d => {
        d.values.forEach(v => {
            if (v.value !== 0) { // Assuming zero means no data
                axesWithData.add(v.axis);
            }
        });
    });

    // Slightly adjust the angles to spread out overlapping axes
    const adjustedMetrics = [
        { axis: "Dentists", angle: 0 },
        { axis: "Midwifes", angle: (2 * Math.PI) / 5 },
        { axis: "Nurses", angle: (4 * Math.PI) / 5 },
        { axis: "Pharmacists", angle: (6 * Math.PI) / 5 },
        { axis: "Physicians", angle: (8 * Math.PI) / 5 }
    ];

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, radius]);

    const gridLevels = 5;

    // Update grid circles with transition
    const gridCircles = svg.selectAll(".radar-circle")
        .data(d3.range(1, gridLevels + 1));

    // Exit
    gridCircles.exit()
        .transition()
        .duration(transitionDuration)
        .style("opacity", 0)
        .remove();

    // Enter
    const gridCirclesEnter = gridCircles.enter()
        .append("circle")
        .attr("class", "radar-circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .style("opacity", 0);

    // Update + Enter
    gridCircles.merge(gridCirclesEnter)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1)
        .attr("r", d => (radius * d) / gridLevels);

    // Update axes with transition
    const axes = svg.selectAll(".radar-axis")
        .data(adjustedMetrics);

    // Enter
    const axesEnter = axes.enter()
        .append("line")
        .attr("class", "radar-axis")
        .attr("x1", 0)
        .attr("y1", 0);

    // Update + Enter
    axes.merge(axesEnter)
        .transition()
        .duration(transitionDuration)
        .attr("x2", d => radius * Math.cos(d.angle - Math.PI / 2))
        .attr("y2", d => radius * Math.sin(d.angle - Math.PI / 2))
        .style("stroke", d => (axesWithData.has(d.axis) ? "black" : "grey"));

    // Update axis labels with transition
    const axisLabels = svg.selectAll(".radar-axis-label")
        .data(adjustedMetrics);

    // Enter
    const axisLabelsEnter = axisLabels.enter()
        .append("text")
        .attr("class", "radar-axis-label")
        .style("opacity", 0);

    // Update + Enter
    axisLabels.merge(axisLabelsEnter)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1)
        .attr("x", d => (radius + 20) * Math.cos(d.angle - Math.PI / 2))
        .attr("y", d => (radius + 20) * Math.sin(d.angle - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = d.angle;
            if (Math.abs(angle - Math.PI) < 0.1) return "end";
            if (Math.abs(angle) < 0.1) return "start";
            return "middle";
        })
        .attr("dominant-baseline", d => {
            const angle = d.angle - Math.PI / 2;
            if (angle < -Math.PI / 2 || angle > Math.PI / 2) return "hanging";
            return "middle";
        })
        .style("fill", d => (axesWithData.has(d.axis) ? "black" : "grey"))
        .text(d => d.axis);

    // Create the radar path generator
    const radarLine = d3.lineRadial()
        .radius(d => radiusScale(d.value))
        .angle(d => adjustedMetrics.find(m => m.axis === d.axis).angle)
        .curve(d3.curveLinearClosed);

    // Update radar paths with transition
    const paths = svg.selectAll(".radar-chart-path")
        .data(filteredData, d => d.country); // Use country as key for smooth transitions

    // Exit
    paths.exit()
        .transition()
        .duration(transitionDuration)
        .style("opacity", 0)
        .remove();

    // Enter
    const pathsEnter = paths.enter()
        .append("path")
        .attr("class", "radar-chart-path")
        .style("fill-opacity", 0.3)
        .style("stroke-width", "2px")
        .style("opacity", 0)
        .attr("d", d => radarLine(d.values));

    // Update + Enter
    paths.merge(pathsEnter)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1)
        .style("fill", d => colorScale(d.country))
        .style("stroke", d => colorScale(d.country))
        .attr("d", d => radarLine(d.values));

    // Add hover effects and tooltip
    paths.merge(pathsEnter)
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("fill-opacity", 0.7)
                .style("stroke-width", "3px");

            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);

            let tooltipHTML = `<strong>${d.country}</strong><br/>Year: ${d.year}<br/><br/>`;
            d.values.forEach(v => {
                tooltipHTML += `${v.axis}: ${v.value.toFixed(2)}<br/>`;
            });

            tooltip.html(tooltipHTML)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("fill-opacity", 0.3)
                .style("stroke-width", "2px");

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Update value labels with transition
    const gridLabels = svg.selectAll(".radar-value-label")
        .data(d3.range(1, gridLevels + 1));

    // Enter
    const gridLabelsEnter = gridLabels.enter()
        .append("text")
        .attr("class", "radar-value-label")
        .attr("x", 5)
        .style("opacity", 0);

    // Update + Enter
    gridLabels.merge(gridLabelsEnter)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1)
        .attr("y", d => -radius * d / gridLevels)
        .text(d => (maxValue * d / gridLevels).toFixed(1));

    // Update title with transition
    const title = svg.selectAll(".chart-title")
        .data([`Medical graduates per 100,000 (${currentYear})`]);

    // Enter
    const titleEnter = title.enter()
        .append("text")
        .attr("class", "chart-title")
        .attr("x", 0)
        .attr("y", -height / 2 - 20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("opacity", 0);

    // Update + Enter
    title.merge(titleEnter)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1)
        .text(d => d);

        createSparklines();
}

// Add this function to create area charts
function createSparklines() {
    const chartsContainer = d3.select("#area-charts");
    chartsContainer.selectAll("*").remove();

    selectedCountries.forEach(country => {
        const countryContainer = chartsContainer.append("div")
            .attr("class", "country-sparklines bg-gray-50 p-4 rounded mb-4");

        countryContainer.append("h3")
            .attr("class", "text-lg font-semibold mb-2")
            .text(country);

        const sparklineContainer = countryContainer.append("div")
            .attr("class", "grid grid-cols-5 gap-4");

        const countryData = rawData.filter(d => d.country === country);

        metrics.forEach(metric => {
            const sparkDiv = sparklineContainer.append("div")
                .attr("class", "metric-sparkline");

            sparkDiv.append("p")
                .attr("class", "text-sm font-medium mb-1")
                .text(metric);

            const svg = sparkDiv.append("svg")
                .attr("width", "100%")
                .attr("height", "50px")
                .attr("viewBox", "0 0 120 50");

            const metricData = countryData.map(d => ({
                year: d.year,
                value: d.values.find(v => v.axis === metric).value
            }));

            const xScale = d3.scaleLinear()
                .domain(d3.extent(metricData, d => d.year))
                .range([5, 115]);

            const yScale = d3.scaleLinear()
                .domain([0, d3.max(metricData, d => d.value)])
                .range([45, 5]);

            // Add reference lines (optional)
            svg.append("line")
                .attr("x1", 5)
                .attr("x2", 115)
                .attr("y1", 45)
                .attr("y2", 45)
                .attr("stroke", "#eee")
                .attr("stroke-width", 1);

            // Add sparkline
            const line = d3.line()
                .x(d => xScale(d.year))
                .y(d => yScale(d.value));

            svg.append("path")
                .datum(metricData)
                .attr("fill", "none")
                .attr("stroke", colorScale(metric))
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Add vertical line for current year
            const currentYearX = xScale(currentYear);
            svg.append("line")
                .attr("class", "current-year-line")
                .attr("x1", currentYearX)
                .attr("x2", currentYearX)
                .attr("y1", 5)
                .attr("y2", 45)
                .attr("stroke", "#666")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");

            // Add dots for data points (optional)
            svg.selectAll(".data-point")
                .data(metricData)
                .enter()
                .append("circle")
                .attr("class", "data-point")
                .attr("cx", d => xScale(d.year))
                .attr("cy", d => yScale(d.value))
                .attr("r", 1.5)
                .attr("fill", colorScale(metric));

            // Highlight current year point
            const currentYearData = metricData.find(d => d.year === currentYear);
            if (currentYearData) {
                svg.append("circle")
                    .attr("cx", xScale(currentYearData.year))
                    .attr("cy", yScale(currentYearData.value))
                    .attr("r", 3)
                    .attr("fill", colorScale(metric))
                    .attr("stroke", "white")
                    .attr("stroke-width", 1);
            }

            // Add value display
            const currentValue = metricData.find(d => d.year === currentYear)?.value;
            sparkDiv.append("p")
                .attr("class", "text-sm text-gray-600 mt-1")
                .text(currentValue ? currentValue.toFixed(2) : "N/A");

            // Add tooltip
            const tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            // Add invisible overlay for hover interactions
            svg.append("rect")
                .attr("x", 5)
                .attr("y", 5)
                .attr("width", 110)
                .attr("height", 40)
                .attr("fill", "transparent")
                .on("mousemove", function(event) {
                    const [mouseX] = d3.pointer(event);
                    const year = Math.round(xScale.invert(mouseX));
                    const data = metricData.find(d => d.year === year);
                    
                    if (data) {
                        tooltip.style("opacity", 1)
                            .html(`Year: ${data.year}<br>${metric}: ${data.value.toFixed(2)}`)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    }
                })
                .on("mouseout", function() {
                    tooltip.style("opacity", 0);
                });
        });
    });
}
