const countryNameMap = {
    "Russian Federation": "Russia",
    "United States": "United States of America",
    "Korea, Republic of": "South Korea",
    "Moldova, Republic of": "Moldova",
    "Venezuela, Bolivarian Republic of": "Venezuela",
    "Iran, Islamic Republic of": "Iran",
    "Syrian Arab Republic": "Syria",
    "Viet Nam": "Vietnam",
    "Lao People's Democratic Republic": "Laos",
    "Brunei Darussalam": "Brunei",
    "Bolivia, Plurinational State of": "Bolivia",
    "Tanzania, United Republic of": "Tanzania",
    "Czechia": "Czech Republic"
};

const visaExemptCountries = new Set([
    "North Macedonia",
    "former Yugoslav Republic of Macedonia",
    "Andorra",
    "United Arab Emirates",
    "Antigua and Barbuda",
    "Albania",
    "Argentina",
    "Australia",
    "Bosnia and Herzegovina",
    "Barbados",
    "Brunei",
    "Brazil",
    "Bahamas",
    "Canada",
    "Chile",
    "Colombia",
    "Costa Rica",
    "Dominica",
    "Micronesia",
    "Grenada",
    "Georgia",
    "Guatemala",
    "Honduras",
    "Israel",
    "Japan",
    "Kiribati",
    "Saint Kitts and Nevis",
    "South Korea",
    "Korea, Republic of",
    "Saint Lucia",
    "Monaco",
    "Moldova",
    "Moldova, Republic of",
    "Montenegro",
    "Marshall Islands",
    "Mauritius",
    "Mexico",
    "Malaysia",
    "Nicaragua",
    "Nauru",
    "New Zealand",
    "Panama",
    "Peru",
    "Palau",
    "Paraguay",
    "Serbia",
    "Solomon Islands",
    "Seychelles",
    "Singapore",
    "San Marino",
    "El Salvador",
    "Timor-Leste",
    "Tonga",
    "Trinidad and Tobago",
    "Tuvalu",
    "Ukraine",
    "United Kingdom",
    "United States",
    "United States of America",
    "Uruguay",
    "Holy See",
    "Vatican City",
    "Saint Vincent and the Grenadines",
    "Venezuela",
    "Venezuela, Bolivarian Republic of",
    "Samoa",
    "Hong Kong SAR",
    "Macao SAR",
    "Taiwan",
    "Kosovo"
]);

class FeeVis {
    constructor(parentElement, geoData, rawData) {
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.rawData = rawData;
        this.fee = 90;
        this.years = new Set(this.rawData.map(d => +d.reporting_year));
        this.schengenCountries = new Set(this.rawData.map(d => d.reporting_state));

        this.countryToContinent = {};
        this.geoData.features.forEach(d => this.countryToContinent[d.properties.formal_en] = d.properties.continent);

        let groupedData = [];

        this.rawData
            .filter(d =>
                !this.schengenCountries.has(d.consulate_country) &&
                !visaExemptCountries.has(d.consulate_country))
            .forEach(rd => {
                let year = rd.reporting_year;
                let applyingCountry = rd.consulate_country;
                let applyingContinent = this.countryToContinent[rd.consulate_country];
                let schengenCountry = rd.reporting_state;
                let application = +rd.visitor_visa_applications;
                let issued = +rd.visitor_visa_issued;
                let notIssued = +rd.visitor_visa_not_issued;

                if (!applyingContinent || application === 0) return;

                let indexCountrySchengen = `${year}|${applyingCountry}|${schengenCountry}`;
                let indexCountryEU = `${year}|${applyingCountry}|EU`;
                let indexContinentSchengen = `${year}|${applyingContinent}|${schengenCountry}`;
                let indexContinentEU = `${year}|${applyingContinent}|EU`;

                if (!groupedData[indexCountrySchengen]) {
                    groupedData[indexCountrySchengen] = {
                        year: year,
                        applier: applyingCountry,
                        level: "Country",
                        schengenCountry: schengenCountry,
                        application: application,
                        issued: issued,
                        notIssued: notIssued,
                    };
                }

                if (!groupedData[indexCountryEU]) {
                    groupedData[indexCountryEU] = {
                        year: year,
                        applier: applyingCountry,
                        level: "Country",
                        schengenCountry: "EU",
                        application: 0,
                        issued: 0,
                        notIssued: 0,
                    };
                }

                if (!groupedData[indexContinentSchengen]) {
                     groupedData[indexContinentSchengen] = {
                         year: year,
                         applier: applyingContinent,
                         level: "Continent",
                         schengenCountry: schengenCountry,
                         application: 0,
                         issued: 0,
                         notIssued: 0
                    };
                }

                if (!groupedData[indexContinentEU]) {
                    groupedData[indexContinentEU] = {
                        year: year,
                        applier: applyingContinent,
                        level: "Continent",
                        schengenCountry: "EU",
                        application: 0,
                        issued: 0,
                        notIssued: 0
                    };
                }

                groupedData[indexCountryEU].application += application;
                groupedData[indexCountryEU].issued += issued;
                groupedData[indexCountryEU].notIssued += notIssued;
                groupedData[indexContinentSchengen].application += application;
                groupedData[indexContinentSchengen].issued += issued;
                groupedData[indexContinentSchengen].notIssued += notIssued;
                groupedData[indexContinentEU].application += application;
                groupedData[indexContinentEU].issued += issued;
                groupedData[indexContinentEU].notIssued += notIssued;
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
            .data([0, 1, 2, 3, 4, 5, 6])
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
            .data([0, 1, 2, 3, 4, 5, 6])
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

        vis.updateVis(window.feeVisRegion, window.feeVisLevel);
    }

    updateVis(region, level, year = 2005, mode = false) {
        let vis = this;
        vis.chart.selectAll("*").remove();

        vis.centerX = vis.width / 2;
        vis.centerY = vis.height / 2 - 80;

        d3.select("#" + vis.parentElement + "-title").text("The Fee Received by " + region);
        d3.select("#the-one").text(region);

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
        let unitFee = celling3M(d3.max(visData, d => d.fee)) / 6;
        let rectData = visData.map(d => {
            let euro = vis.euro[Math.floor(d.fee / unitFee)];
            let ratio = euro.ratio;
            let path = euro.path;
            let size = d.fee / totalFee * vis.gArea / visData.length + 3000;
            return {
                text: d.applier,
                fee: Math.round(d.fee / 1000) / 1000 + "M",
                width: Math.sqrt(size * ratio),
                height: Math.sqrt(size / ratio),
                path: path,
            };
        });



        rectPacking(rectData, vis.centerX, vis.centerY);

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
            .style("font-size", d => d3.min([d.width / d.text.length * 1.85, 16]))
            .text(d => d.text);

        cellText.append("tspan")
            .attr("x", d => d.x + d.width/2)
            .attr("dy", "1em")
            .style("font-size", 16)
            .text(d => d.fee);

        cells.on("mouseover", function () {
            d3.select(this).select("text")
                .transition().duration(200)
                .style("opacity", 1);
            d3.select(this).select("rect")
                .transition().duration(200)
                .style("opacity", 0.3);
            })
            .on("mouseout", function () {
                d3.select(this).select("text")
                    .transition().duration(200)
                    .style("opacity", 0);
                d3.select(this).select("rect")
                    .transition().duration(200)
                    .style("opacity", 0);
            });

        vis.labels.data([0, 1, 2, 3, 4, 5, 6])
            .text(d => {
                if (unitFee) return d * unitFee / 1000000 + "M";
                else return "-";
            });
    }
}

function celling3M(num) {
    return Math.ceil(num/3000000) * 3000000;
}

function isOverlap(a, b, margin) {
    return !(
        a.x + a.width + margin < b.x - margin ||
        a.x - margin > b.x + b.width + margin ||
        a.y + a.height + margin < b.y - margin ||
        a.y - margin > b.y + b.height + margin
    );
}

function rectPacking(rects, centerX, centerY, margin = 5) {
    let placedRects = [[], [], [], []];
    let index = 0;

    rects.forEach((r, i) => {
        if (i === 0) {r.x = centerX - r.width - margin; r.y = centerY - r.height - margin; placedRects[i].push(r);}
        if (i === 1) {r.x = centerX + margin; r.y = centerY - r.height - margin; placedRects[i].push(r);}
        if (i === 2) {r.x = centerX + margin; r.y = centerY + margin; placedRects[i].push(r);}
        if (i === 3) {r.x = centerX - r.width - margin; r.y = centerY + margin; placedRects[i].push(r);}

        if (i >= 4) {
            r.x = centerX - r.width / 2;
            r.y = centerY - r.height / 2;

            while (placedRects[index % 4].some(pr => isOverlap(pr, r, margin)) &&
            placedRects[(index+1) % 4].some(pr => isOverlap(pr, r, margin)))
            {
                if (index % 4 === 0) r.y--
                if (index % 4 === 1) r.x++
                if (index % 4 === 2) r.y++
                if (index % 4 === 3) r.x--
            }

            if (placedRects[index % 4].some(pr => isOverlap(pr, r, margin))) {
                while (placedRects[index % 4].some(pr => isOverlap(pr, r, margin))) {
                    if (index % 4 === 0) r.x++
                    if (index % 4 === 1) r.y++
                    if (index % 4 === 2) r.x--
                    if (index % 4 === 3) r.y--
                }

                index++;
            }
            else {
                while (placedRects[(index+1) % 4].some(pr => isOverlap(pr, r, margin))) {
                    if (index % 4 === 0) r.x--
                    if (index % 4 === 1) r.y--
                    if (index % 4 === 2) r.x++
                    if (index % 4 === 3) r.y++
                }
            }

            placedRects[index % 4].push(r);
        }
    });
}