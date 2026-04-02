const visaExemptCountryCodes = new Set([
    "MKD", "MKD", "AND", "ARE", "ATG",
    "ALB", "ARG", "AUS", "BIH", "BRB",
    "BRN", "BRA", "BHS", "CAN", "CHL",
    "COL", "CRI", "DMA", "FSM", "GRD",
    "GEO", "GTM", "HND", "ISR", "JPN",
    "KIR", "KNA", "KOR", "KOR", "LCA",
    "MCO", "MDA", "MDA", "MNE", "MHL",
    "MUS", "MEX", "MYS", "NIC", "NRU",
    "NZL", "PAN", "PER", "PLW", "PRY",
    "SRB", "SLB", "SYC", "SGP", "SMR",
    "SLV", "TLS", "TON", "TTO", "TUV",
    "UKR", "GBR", "USA", "USA", "URY",
    "VAT", "VAT", "VCT", "VEN", "VEN",
    "WSM", "HKG", "MAC", "TWN", "XKX",
    "IRL"
]);

class FeeVis {
    constructor(parentElement, geoData, rawData) {
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.rawData = rawData;
        this.fee = 90;
        this.years = new Set(this.rawData.map(d => +d.reporting_year));
        this.schengenCountries = new Set(this.rawData.map(d => d.reporting_state));

        this.countryCodeToContinent = {};
        this.geoData.features.forEach(d => this.countryCodeToContinent[d.properties.iso_a3] = d.properties.continent);

        let groupedData = [];

        this.rawData
            .filter(d =>
                !this.schengenCountries.has(d.consulate_country) &&
                !visaExemptCountryCodes.has(d.consulate_country_code))
            .forEach(rd => {
                let year = rd.reporting_year;
                let applyingCountry = rd.consulate_country;
                let applyingContinent = this.countryCodeToContinent[rd.consulate_country_code];
                let schengenCountry = rd.reporting_state;
                let application = +rd.visitor_visa_applications;
                let issued = +rd.visitor_visa_issued;
                let notIssued = +rd.visitor_visa_not_issued;

                if (!applyingContinent || application === 0) return;

                let indexes = [
                    [applyingCountry, "Country", schengenCountry],
                    [applyingCountry, "Country", "EU"],
                    [applyingContinent, "Continent", schengenCountry],
                    [applyingContinent, "Continent", "EU"],
                ]

                indexes.forEach(index => {
                    let key = `${year}|${index[0]}|${index[2]}`;

                    if (!groupedData[key]) {
                        groupedData[key] = {
                            year: year,
                            applier: index[0],
                            level: index[1],
                            schengenCountry: index[2],
                            application: 0,
                            issued: 0,
                            notIssued: 0,
                        };
                    }

                    groupedData[key].application += application;
                    groupedData[key].issued += issued;
                    groupedData[key].notIssued += notIssued;
                });
            });

        this.cleanedData = Object.values(groupedData);

        this.cleanedData.forEach(d => {
            d.fee = d.application * this.fee;
            d.approvalRate = d.issued / d.application;
            d.refusalRate = d.notIssued / d.application;
        });
    }

    async initVis() {
        let vis = this;

        vis.euro = await Promise.all(
            [0, 1, 2, 3, 4, 5].map(d => {
                return new Promise(resolve => {
                    let path = "images/euro-" + d + ".png";
                    let img = new Image();

                    img.onload = function () {
                        resolve({
                            path: path,
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                            ratio: img.naturalWidth / img.naturalHeight
                        });
                    };

                    img.src = path;
                });
            })
        );

        vis.margin = {top: 40, bottom: 40, left: 40, right: 40};
        vis.container = document.getElementById(vis.parentElement).getBoundingClientRect();
        vis.width = vis.container.width - vis.margin.left - vis.margin.right;
        vis.height = vis.container.height - vis.margin.top - vis.margin.bottom;
        vis.gArea = vis.width * vis.height;

        vis.svg = d3.select("#" + vis.parentElement)
            .append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom);

        vis.chart = vis.svg.append("g")
            .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);

        vis.legendGroup = vis.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${vis.margin.left}, ${vis.height})`);

        const xScale = d3.scaleLinear()
            .domain([0, 6])
            .range([0, 360]);

        vis.legendGroup.append("line")
            .attr("x1", xScale(0))
            .attr("x2", xScale(6))
            .attr("y1", 0)
            .attr("y2", 0)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        vis.legendGroup.selectAll(".tick")
            .data([0, 1, 2, 3, 4, 5])
            .enter()
            .append("line")
            .attr("class", "tick")
            .attr("x1", (d, i) => xScale(i))
            .attr("x2", (d, i) => xScale(i))
            .attr("y1", -10)
            .attr("y2", 10)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        vis.labels = vis.legendGroup.selectAll(".label")
            .data([0, 1, 2, 3, 4, 5])
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("x", (d, i) => xScale(i))
            .attr("y", -15)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .text("-");

        vis.legendGroup.selectAll(".legend-img")
            .data(vis.euro)
            .enter()
            .append("image")
            .attr("class", "legend-img")
            .attr("xlink:href", d => d.path)
            .attr("x", (d, i) => xScale(i) + 10)
            .attr("y", 15)
            .attr("width", d => d.width / 10)
            .attr("height", d => d.height / 10);

        vis.updateVis();

        const container = d3.select("#fee-vis-region-selector");

        container.selectAll("*").remove();

        container
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("gap", "8px")
            .style("overflow-y", "auto");

        const pills = container.selectAll(".pill")
            .data(vis.schengenCountries)
            .enter()
            .append("div")
            .attr("class", "pill")
            .text(d => d);

        pills.on("click", function(event, d) {
            window.feeVisRegion = d;

            pills.classed("selected", false);
            d3.select(this).classed("selected", true);

            vis.updateVis();
        });
    }

    updateVis(mode = false) {
        let region = window.feeVisRegion;
        let level = window.feeVisLevel;
        let year = window.feeVisYear;
        let vis = this;

        vis.chart.selectAll("*").remove();

        vis.centerX = vis.width / 2;
        vis.centerY = vis.height / 2 - 80;

        d3.select("#" + vis.parentElement + "-title").text("The Fee Received by " + region);
        d3.select("#the-one").text("Paid To " + region);

        let visData = [];
        if (mode) {}
        else {
            visData = vis.cleanedData
                .filter(d => d.schengenCountry === region && d.year === year && d.level === level)
                .sort((a, b) => a.applier.localeCompare(b.applier));
        }

        if (visData.length === 0) {
            let text = vis.chart.append("text")
                .attr("class", "no-data")
                .attr("x", vis.centerX)
                .attr("y", vis.centerY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("fill", "#9ca3af")
                .style("opacity", 1);

            text.append("tspan")
                .attr("x", vis.centerX)
                .attr("dy", 0)
                .style("font-size", 20)
                .text("No Data Reported By " + region + " In " + year);

            text.append("tspan")
                .attr("x", vis.centerX)
                .attr("dy", "2em")
                .style("font-size", 16)
                .text("Click on the year on the left to select year");
        }

        let totalFee = d3.sum(visData, d => d.fee);
        d3.select("#" + vis.parentElement + "-total").text("Total: " + totalFee);
        let unitFee = celling6M(d3.max(visData, d => d.fee)) / 24;
        let rectData = visData.map(d => {
            let index = Math.floor(d.fee / unitFee);
            let euro = vis.euro[d3.min([index, 5])];
            let ratio = euro.ratio;
            let path = euro.path;
            let size = d.fee / totalFee * vis.gArea / visData.length * 8 + 1000;
            return {
                text: d.applier,
                fee: Math.round(d.fee / 1000) / 1000 + "M",
                width: Math.sqrt(size * ratio),
                height: Math.sqrt(size / ratio),
                path: path,
            };
        });

        rectPacking(rectData, vis.width);

        vis.chart.selectAll(".vis-image")
            .data(rectData)
            .join("image")
            .attr("class", "vis-image")
            .attr("width", d => d.width)
            .attr("height", d => d.height)
            .attr("href", d => d.path)
            .attr("x", d => d.x)
            .attr("y", d => d.y);

        let cells = vis.chart.selectAll(".cell")
            .data(rectData)
            .join("g")
            .attr("class", "cell");

        cells.selectAll(".vis-rect")
            .data(d => [d])
            .join("rect")
            .attr("class", "vis-rect")
            .attr("width", d => d.width)
            .attr("height", d => d.height)
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("fill", "black")
            .attr("opacity", 0);

        let cellText = cells.selectAll(".vis-text")
            .data(d => [d])
            .join("text")
            .attr("class", "vis-text")
            .attr("x", d => d.x + d.width/2)
            .attr("y", d => d.y + d.height/2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("opacity", 0)
            .style("fill", "white")

        cellText.append("tspan")
            .attr("x", d => d.x + d.width/2)
            .attr("dy", "-0.5em")
            .style("font-size", d => d3.min([d.width / d.text.length * 1.5, 12]))
            .text(d => d.text);

        cellText.append("tspan")
            .attr("x", d => d.x + d.width/2)
            .attr("dy", "1.25em")
            .style("font-size", d => d3.min([d.width / d.fee.length * 1.5, 12]))
            .text(d => d.fee);

        cells.on("mouseover", function () {
            d3.select(this).select("text")
                .transition().duration(200)
                .style("opacity", 1);
            d3.select(this).select("rect")
                .transition().duration(200)
                .style("opacity", 0.5);
            })
            .on("mouseout", function () {
                d3.select(this).select("text")
                    .transition().duration(200)
                    .style("opacity", 0);
                d3.select(this).select("rect")
                    .transition().duration(200)
                    .style("opacity", 0);
            });

        vis.labels.data([0, 1, 2, 3, 4, 5])
            .text(d => {
                if (unitFee) return d * unitFee / 1000000 + "M";
                else return "-";
            });
    }
}

function celling6M(num) {
    return Math.ceil(num/6000000) * 6000000;
}

function rectPacking(rects, width, gap = 5) {
    let currentX = 0;
    let currentY = 0;
    let nextRow = 0;

    rects.forEach(rect => {
        if (currentX + rect.width > width) {
            currentX = 0;
            currentY = currentY + nextRow + gap;
            nextRow = rect.height;
        }
        else {
            nextRow = d3.max([nextRow, rect.height]);
        }

        rect.x = currentX;
        rect.y = currentY;

        currentX = currentX + rect.width + gap;
    });
}