// Set the dimensions and margins
const width = 960;
const height = 500;
const margin = {top: 20, right: 20, bottom: 20, left: 20};

// Create SVG container
const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Create a group for the map that will be transformed
const g = svg.append("g");

// Create a projection
const projection = d3.geoMercator()
    .scale(130)
    .center([0, 20])
    .translate([width / 2, height / 2]);

// Create a path generator
const path = d3.geoPath()
    .projection(projection);

// Color scale
const colorScale = d3.scaleQuantile()
    .range(d3.schemeBlues[7]);

let graduatesData;
let currentYear;
let currentZoom = 1;

// Create zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

// Apply zoom behavior to SVG
svg.call(zoom);

// Zoom function
function zoomed(event) {
    g.attr("transform", event.transform);
    currentZoom = event.transform.k;
    
    // Adjust stroke width based on zoom level
    g.selectAll(".country")
        .style("stroke-width", 0.5 / currentZoom + "px");
}

// Load the data
Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("./csv/OECD-MedicalGraduates-Per-100000-ISO.csv")
]).then(function([worldData, data]) {
    graduatesData = data;

    // Get available years
    const years = [...new Set(data.map(d => +d.Year))].sort();
    currentYear = years[years.length - 1];

    // Setup year slider
    setupYearSlider(years);

    // Set up color scale domain
    updateColorScale(currentYear);

    // Create the map
    createMap(worldData);

    // Create legend
    createLegend();

    //Create chart
    createBarChart();
});

function setupYearSlider(years) {
    const slider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-display');

    slider.min = years[0];
    slider.max = years[years.length - 1];
    slider.value = currentYear;
    yearDisplay.textContent = currentYear;

    slider.addEventListener('input', function() {
        currentYear = +this.value;
        yearDisplay.textContent = currentYear;
        updateColorScale(currentYear);
        updateMap();
        createLegend(); // Update legend for the current year
        createBarChart();
    });
}

function updateColorScale(year) {
    const yearData = graduatesData.filter(d => +d.Year === year);
    colorScale.domain(yearData.map(d => +d.Value));
}

function createMap(worldData) {
    // Draw the map
    g.selectAll("path")
        .data(worldData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", "country")
        .attr("fill", d => getCountryColor(d.id))
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("mousemove", handleMouseMove);
}

function getCountryColor(countryName) {
    const countryData = graduatesData.find(d => 
        d.Country === countryName && 
        +d.Year === currentYear
    );

    if (!countryData) return "#eee";
    return colorScale(+countryData.Value);
}

function updateMap() {
    g.selectAll(".country")
        .transition()
        .duration(1000)
        .attr("fill", d => getCountryColor(d.id));
}

function updateColorScale(year) {
    const yearData = graduatesData.filter(d => +d.Year === year);
    const values = yearData.map(d => +d.Value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    colorScale.domain([minValue, maxValue]);
}

function createLegend() {
    const legendWidth = 300;
    const legendHeight = 20;

    d3.select("#legend").selectAll("*").remove(); // Clear previous legend

    const legend = d3.select("#legend")
        .append("svg")
        .attr("width", legendWidth)
        .attr("height", legendHeight * 2);

    const legendScale = d3.scaleLinear()
        .range([0, legendWidth])
        .domain(colorScale.domain()); // Set domain based on current color scale

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format(".1f"));

    // Add gradient
    const defs = legend.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

    colorScale.range().forEach((color, i) => {
        gradient.append("stop")
            .attr("offset", `${i * 100 / (colorScale.range().length - 1)}%`)
            .attr("stop-color", color);
    });

    // Add gradient rect
    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#gradient)");

    // Add axis
    legend.append("g")
        .attr("transform", `translate(0,${legendHeight})`)
        .call(legendAxis);
}

function handleMouseOver(event, d) {
    const countryData = graduatesData.find(data => 
        data.Country === d.id && 
        +data.Year === currentYear
    );

    d3.select(this)
        .style("stroke-width", 2 / currentZoom + "px")
        .style("stroke", "#333");

    const tooltip = d3.select("#tooltip");
    
    if (countryData) {
        tooltip.html(`
            <strong>${d.properties.name}</strong><br/>
            Year: ${currentYear}<br/>
            Medical Graduates: ${(+countryData.Value).toFixed(2)} per 100,000
        `)
        .style("opacity", 1);
    } else {
        tooltip.html(`
            <strong>${d.id}</strong><br/>
            No data available
        `)
        .style("opacity", 1);
    }
}

function handleMouseOut() {
    d3.select(this)
        .style("stroke-width", 0.5 / currentZoom + "px")
        .style("stroke", "#fff");

    d3.select("#tooltip")
        .style("opacity", 0);
}

function handleMouseMove(event) {
    const svgRect = svg.node().getBoundingClientRect();

    // Calculate the position relative to the SVG container
    const tooltipX = event.clientX - svgRect.left + 45; // Adjusted for better positioning
    const tooltipY = event.clientY - svgRect.top - 10;

    d3.select("#tooltip")
        .style("left", tooltipX + "px")
        .style("top", tooltipY + "px");
}

function createBarChart() {
    const margin = {top: 10, right: 30, bottom: 30, left: 30};
    const width = 270 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Clear previous chart
    d3.select("#bar-chart").selectAll("*").remove();

    // Append the svg object to the body of the page
    const svg = d3.select("#bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X axis
    const x = d3.scaleLinear()
        .range([0, width]);

    // Y axis
    const y = d3.scaleBand()
        .range([0, height])
        .padding(0.1);

    // Filter data for the current year
    const yearData = graduatesData.filter(d => +d.Year === currentYear);

    // Sort data in descending order
    yearData.sort((a, b) => d3.descending(+a.Value, +b.Value));

    // Update the X axis
    x.domain([0, d3.max(yearData, d => +d.Value)]);

    // Update the Y axis
    y.domain(yearData.map(d => d.Country));

    const bars = svg.selectAll("rect")
        .data(yearData);

    // Exit old bars
    bars.exit().remove();

    // Update existing bars
    bars.transition()
        .duration(500)
        .attr("y", d => y(d.Country))
        .attr("height", y.bandwidth())
        .attr("fill", d => getCountryColor(d.Country))
        .attr("x", 0)
        .attr("width", d => x(+d.Value));

    // Enter new bars
    bars.enter()
        .append("rect")
        .attr("y", d => y(d.Country))
        .attr("height", y.bandwidth())
        .attr("fill", d => getCountryColor(d.Country))
        .attr("x", 0)
        .attr("width", 0)
        .transition()
        .duration(500)
        .attr("width", d => x(+d.Value));


    // Add the X Axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Add the Y Axis
    svg.append("g")
        .call(d3.axisLeft(y));
}
		