const margin = { top: 20, right: 30, bottom: 40, left: 50 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3.select("#line-chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const colors = d3.scaleOrdinal(d3.schemeCategory10);

// Store selected countries
let selectedCountries = new Set();

// Create tooltip div
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "5px")
    .style("padding", "5px");

// Load the data
d3.csv("./csv/OECD-MedicalGraduates-Per-100000.csv", d3.autoType).then(data => {
    const nestedData = d3.group(data, d => d.Country);
    const countries = Array.from(nestedData.keys());

    // Create checkboxes for each country
    function createCountryCheckboxes() {
        const container = d3.select("#country-checkboxes");

        countries.forEach(country => {
            const checkboxContainer = container.append("div")
                .attr("class", "checkbox-container");

            checkboxContainer.append("div")
                .attr("class", "color-indicator")
                .style("background-color", colors(country));

            checkboxContainer.append("label")
                .html(`<input type="checkbox" value="${country}" checked> ${country}`);

            // Initially add all countries to selectedCountries
            selectedCountries.add(country);
        });

        // Add event listeners for each checkbox
        container.selectAll("input")
            .on("change", function () {
                const country = this.value;
                if (this.checked) {
                    selectedCountries.add(country);
                } else {
                    selectedCountries.delete(country);
                }
                update();  // Call update function to refresh the chart based on selected countries
            });

        // Add "Select All" and "Clear All" buttons
        d3.select("#select-all-countries").on("click", () => {
            container.selectAll("input").property("checked", true);
            selectedCountries = new Set(countries);
            update();
        });

        d3.select("#clear-all-countries").on("click", () => {
            container.selectAll("input").property("checked", false);
            selectedCountries.clear();
            update();
        });
    }

    // Initialize checkboxes
    createCountryCheckboxes();

    // Scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.Year))
        .range([0, width]);

    let yScale = d3.scaleLinear().range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .attr("class", "x-axis")
        .call(xAxis);

    const yAxisGroup = svg.append("g").attr("class", "y-axis");

    // Line generator
    const line = d3.line()
        .x(d => xScale(d.Year))
        .y(d => yScale(d.Value));

    // Main update function
    function update() {
        // Filter data for selected countries
        const selectedData = Array.from(selectedCountries).map(country => ({
            country,
            values: nestedData.get(country)
        }));

        // Update yScale domain based on selected countries' data
        const maxValue = d3.max(selectedData, d => d3.max(d.values, v => v.Value)) || 0;
        yScale.domain([0, maxValue]).nice();

        // Update y-axis with transition
        yAxisGroup.transition()
            .duration(750)
            .call(yAxis);

        // Bind data and draw lines with transitions
        const lines = svg.selectAll(".line")
            .data(selectedData, d => d.country);

        lines.enter()
            .append("path")
            .attr("class", "line")
            .attr("stroke", d => colors(d.country))
            .attr("fill", "none")
            .attr("d", d => line(d.values))
            .style("opacity", 0)
            .transition()
            .duration(750)
            .style("opacity", 1);

        lines.transition()
            .duration(750)
            .attr("d", d => line(d.values))
            .attr("stroke", d => colors(d.country));

        lines.exit()
            .transition()
            .duration(750)
            .style("opacity", 0)
            .remove();

        // Add circles for each data point
        const circles = svg.selectAll(".data-point")
            .data(data.filter(d => selectedCountries.has(d.Country)), d => `${d.Country}-${d.Year}`);

        circles.enter()
            .append("circle")
            .attr("class", "data-point")
            .attr("cx", d => xScale(d.Year))
            .attr("cy", d => yScale(d.Value))
            .attr("r", 5)
            .attr("fill", d => colors(d.Country))
            .style("opacity", 0)
            .on("mouseover", function (event, d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);

                tooltip.html(`<strong>${d.Country}</strong></br>Year: ${d.Year}</br>Graduates per 1000: ${d.Value.toFixed(2)}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .transition()
            .duration(750)
            .style("opacity", 1);

        circles.transition()
            .duration(750)
            .attr("cx", d => xScale(d.Year))
            .attr("cy", d => yScale(d.Value))
            .attr("fill", d => colors(d.Country)); // Ensure the color is updated

        circles.exit()
            .transition()
            .duration(750)
            .style("opacity", 0)
            .remove();

        // Add text labels at the end of each line
        const labels = svg.selectAll(".line-label")
            .data(selectedData, d => d.country);

        labels.enter()
            .append("text")
            .attr("class", "line-label")
            .attr("x", d => xScale(d.values[d.values.length - 1].Year) + 5) // Position slightly to the right of the last data point
            .attr("y", d => yScale(d.values[d.values.length - 1].Value))
            .attr("dy", "0.35em") // Adjust vertical position
            .text(d => d.country)
            .style("font-size", "12px")
            .style("fill", d => colors(d.country))
            .style("opacity", 0)
            .transition()
            .duration(750)
            .style("opacity", 1);

        labels.transition()
            .duration(750)
            .attr("x", d => xScale(d.values[d.values.length - 1].Year) + 5)
            .attr("y", d => yScale(d.values[d.values.length - 1].Value))
            .text(d => d.country)
            .style("fill", d => colors(d.country)); // Ensure the color is updated

        labels.exit()
            .transition()
            .duration(750)
            .style("opacity", 0)
            .remove();

        svg.append("text")
            .attr("transform", `translate(${width / 2}, ${height + margin.top + 20})`)
            .style("text-anchor", "middle")
            .text("Year");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Graduates per 100000");
    }

    // Initialize with current selection
    update();
});