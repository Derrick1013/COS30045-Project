// Set the dimensions and margins
const margin = { top: 40, right: 30, bottom: 60, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// Create SVG container
const svg = d3.select("#bubble-chart")
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
let mergedData;
let selectedCountries = new Set();
let currentYear = 2000;
let animationTimer;

// Load and process the data
Promise.all([
    d3.csv("./csv/OECD-Doctor-Graduates-Merged.csv"),
    d3.csv("./csv/OECD-Gov-HealthSpending.csv")  // Updated filename
]).then(function (datasets) {
    const [graduatesData, pppData] = datasets;
    mergedData = processData(graduatesData, pppData);

    // Setup year slider
    setupYearSlider();
    // Initially select all countries
    selectedCountries = new Set(mergedData.map(d => d.country));
    // Create checkboxes
    createCountryCheckboxes();
    // Initial plot
    updateBubbleChart();

    // Setup year increment and decrement buttons
    document.getElementById('increase-year').addEventListener('click', function () {
        if (currentYear < +document.getElementById('year-slider').max) {
            currentYear++;
            document.getElementById('year-slider').value = currentYear;
            document.getElementById('year-value').textContent = currentYear;
            updateBubbleChart();
        }
    });

    document.getElementById('decrease-year').addEventListener('click', function () {
        if (currentYear > +document.getElementById('year-slider').min) {
            currentYear--;
            document.getElementById('year-slider').value = currentYear;
            document.getElementById('year-value').textContent = currentYear;
            updateBubbleChart();
        }
    });

});



function processData(graduatesData, pppData) {
    // Convert PPP data to a more easily searchable format
    const pppMap = new Map();
    pppData.forEach(row => {
        if (!pppMap.has(row.Country)) {
            pppMap.set(row.Country, new Map());
        }
        pppMap.get(row.Country).set(+row.Year, +row.PPP);
    });

    // Merge the datasets
    const merged = graduatesData.map(grad => {
        const country = grad.Country;
        const year = +grad.Year;
        const ppp = pppMap.get(country)?.get(year);

        return {
            country: country,
            year: year,
            graduates: +grad.Value_graduates,
            doctors: +grad.Value_doctors,
            ppp: ppp
        };
    }).filter(d => d.ppp != null);  // Remove entries without PPP data

    return merged;
}

function setupYearSlider() {
    const years = [...new Set(mergedData.map(d => d.year))].sort();
    const slider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-value');

    slider.min = years[0];
    slider.max = years[years.length - 1];
    slider.value = currentYear;
    yearDisplay.textContent = currentYear;

    slider.addEventListener('input', function () {
        currentYear = +this.value;
        yearDisplay.textContent = currentYear;
        updateBubbleChart();
    });

    // Setup animation controls
    document.getElementById('play-button').addEventListener('click', toggleAnimation);
    document.getElementById('reset-button').addEventListener('click', resetAnimation);
}

function toggleAnimation() {
    const button = document.getElementById('play-button');
    if (button.textContent === 'Play') {
        button.textContent = 'Pause';
        animateChart();
    } else {
        button.textContent = 'Play';
        stopAnimation();
    }
}

function animateChart() {
    const slider = document.getElementById('year-slider');
    const maxYear = +slider.max;

    animationTimer = setInterval(() => {
        if (currentYear >= maxYear) {
            currentYear = +slider.min;
        } else {
            currentYear++;
        }
        slider.value = currentYear;
        document.getElementById('year-value').textContent = currentYear;
        updateBubbleChart();
    }, 1000);
}

function stopAnimation() {
    clearInterval(animationTimer);
}

function resetAnimation() {
    stopAnimation();
    document.getElementById('play-button').textContent = 'Play';
    currentYear = +document.getElementById('year-slider').min;
    document.getElementById('year-slider').value = currentYear;
    document.getElementById('year-value').textContent = currentYear;
    updateBubbleChart();
}

function createCountryCheckboxes() {
    const container = d3.select("#country-checkboxes");
    const countries = [...new Set(mergedData.map(d => d.country))];

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
            updateBubbleChart();
        });

    // Select/Clear all buttons
    d3.select("#select-all-countries").on("click", () => {
        container.selectAll("input").property("checked", true);
        selectedCountries = new Set(countries);
        updateBubbleChart();
    });

    d3.select("#clear-all-countries").on("click", () => {
        container.selectAll("input").property("checked", false);
        selectedCountries.clear();
        updateBubbleChart();
    });
}

function updateBubbleChart() {
    // Filter data for selected year and countries
    const filteredData = mergedData.filter(d =>
        d.year === currentYear &&
        selectedCountries.has(d.country)
    );

    // Update scales
    const xScale = d3.scaleLinear()
        .domain([0, Math.ceil(d3.max(mergedData, d => d.ppp) / 500) * 500])  // Round up to nearest 500
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(mergedData, d => d.graduates)])
        .range([height, 0]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(mergedData, d => d.doctors)])
        .range([5, 30]);

    // Remove existing elements
    svg.selectAll(".axis").remove();
    svg.selectAll(".axis-label").remove();
    svg.selectAll(".title").remove();

    // Bind data to bubbles and add transition
    const bubbles = svg.selectAll(".bubble")
        .data(filteredData, d => d.country);

    // Update X axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .ticks(10)
            .tickFormat(d => `$${d3.format(",")(d)}`)
            .tickValues(d3.range(0, xScale.domain()[1] + 500, 500))
        )
        .append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Healthcare Expenditure per Capita (PPP)");

    // Update Y axis
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
        .text("Medical Graduates per 100,000 Population");


    // Enter new bubbles
    bubbles.enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => xScale(Math.max(d.ppp, 1)))
        .attr("cy", d => yScale(d.graduates))
        .attr("r", d => radiusScale(d.doctors))
        .style("fill", d => colorScale(d.country))
        .style("opacity", 0.9)
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("fill-opacity", 0.9)
                .style("stroke-width", "2px");

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);

            tooltip.html(`
                <strong>${d.country}</strong><br/>
                Year: ${d.year}<br/>
                Healthcare Expenditure: $${d3.format(",.0f")(d.ppp)} per capita<br/>
                Medical Graduates: ${d.graduates.toFixed(2)}<br/>
                Practicing Doctors: ${d.doctors.toFixed(2)}
            `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("fill-opacity", 0.7)
                .style("stroke-width", "1px");

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .transition()  // Add initial fade-in transition
        .duration(500)
        .style("opacity", 0.9);

    // Update existing bubbles with smooth transition
    bubbles.transition()
        .duration(1000)
        .attr("cx", d => xScale(Math.max(d.ppp, 1)))
        .attr("cy", d => yScale(d.graduates))
        .attr("r", d => radiusScale(d.doctors));

    // Remove old bubbles
    bubbles.exit()
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();

    // Add title
    svg.append("text")
        .attr("class", "title")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text(`Healthcare Expenditure (PPP) vs Medical Graduates (${currentYear})`);
}
