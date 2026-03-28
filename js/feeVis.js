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
        this.years = new Set(this.rawData.map(d => +d.reporting_year)); //console.log(this.years);
        this.schengenCountries = new Set(this.rawData.map(d => d.reporting_state)); //console.log(this.schengenCountries);

        this.countryToContinent = {};
        this.geoData.features.forEach(d => {
            let country = d.properties.formal_en;
            let continent = d.properties.continent;

            this.countryToContinent[country] = continent;
        }); //console.log(this.countryToContinent);

        let groupedData = [];

        this.rawData.filter(d => !this.schengenCountries.has(d.consulate_country) && !visaExemptCountries.has(d.consulate_country))
            .forEach(rd => {
                let year = rd.reporting_year;
                let applyingContinent = this.countryToContinent[rd.consulate_country];
                let schengenCountry = rd.reporting_state;
                let application = +rd.visitor_visa_applications;
                let issued = +rd.visitor_visa_issued;
                let notIssued = +rd.visitor_visa_not_issued;

                if (!applyingContinent || application === 0) return;

                let index = `${year}|${applyingContinent}|${schengenCountry}`;
                let indexEU = `${year}|${applyingContinent}|EU`;

                if (!groupedData[index]) {
                     groupedData[index] = {
                         year: year,
                         applyingContinent: applyingContinent,
                         schengenCountry: schengenCountry,
                         application: 0,
                         issued: 0,
                         notIssued: 0
                    };
                }

                if (!groupedData[indexEU]) {
                    groupedData[indexEU] = {
                        year: year,
                        applyingContinent: applyingContinent,
                        schengenCountry: "EU",
                        application: 0,
                        issued: 0,
                        notIssued: 0
                    };
                }

                groupedData[index].application += application;
                groupedData[index].issued += issued;
                groupedData[index].notIssued += notIssued;
                groupedData[indexEU].application += application;
                groupedData[indexEU].issued += issued;
                groupedData[indexEU].notIssued += notIssued;
            });

        this.cleanedData = Object.values(groupedData);

        this.cleanedData.forEach(d => {
            d.fee = d.application * this.fee;
            d.approvalRate = d.issued / d.application;
            d.refusalRate = d.notIssued / d.application;
        }); //console.log(this.cleanedData);
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
        ); //console.log(this.euro);

        vis.margin = {top: 40, bottom: 40, left: 40, right: 40};
        vis.container = document.getElementById(vis.parentElement).getBoundingClientRect();
        vis.width = vis.container.width - vis.margin.left - vis.margin.right;
        vis.height = vis.container.height - vis.margin.top - vis.margin.bottom;

        vis.svg = d3.select("#" + vis.parentElement)
            .append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);

        vis.updateVis();
    }

    updateVis(region = "EU", year = 2005, mode = false) {
        let vis = this;
        vis.centerX = vis.width / 2; console.log(vis.centerX);
        vis.centerY = vis.height / 2; console.log(vis.centerY);

        let visData = [];
        if (mode) {
            visData = vis.cleanedData
                .filter(d => d.schengenCountry === region && d.year === year)
                .sort((a, b) => a.applyingContinent.localeCompare(b.applyingContinent));
        }
        else {
            visData = vis.cleanedData
                .filter(d => d.schengenCountry === region && d.year === year)
                .sort((a, b) => a.applyingContinent.localeCompare(b.applyingContinent));

        } //console.log(visData);

        let totalFee = d3.sum(visData, d => d.fee); //console.log(totalFee);
        let unitFee = celling6M(d3.max(visData, d => d.fee)) / 6; //console.log(unitFee);
        let level = visData.map(d => Math.floor(d.fee / unitFee)); //console.log(level);
        let rectData = visData.map((d, i) => {
            let euro = vis.euro[level[i]];
            let ratio = euro.ratio;
            let path = euro.path;
            let size = d.fee / totalFee * 40000;
            return {
                width: Math.sqrt(size * ratio),
                height: Math.sqrt(size / ratio),
                path: path,
                x: 0,
                y: 0,
            };
        }); console.log(rectData);

        packCornersDynamic(rectData, vis.centerX, vis.centerY, 10);

        vis.rects = vis.svg.selectAll("image")
            .data(rectData)
            .join("image")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("width", d => d.width)
            .attr("height", d => d.height)
            .attr("href", d => d.path);
    }
}

function celling6M(num) {
    return Math.ceil(num/6000000) * 6000000;
}

function overlaps(a, b, gap = 8) {
    return !(
        a.x + a.width/2 + gap < b.x - b.width/2 ||
        a.x - a.width/2 - gap > b.x + b.width/2 ||
        a.y + a.height/2 + gap < b.y - b.height/2 ||
        a.y - a.height/2 - gap > b.y + b.height/2
    );
}

function packCornersDynamic(rects, centerX, centerY, gap = 10) {
    let quarterIndex = 0;
    let placedRects = [[],[],[],[]];

    rects.forEach(rect => {
        if (quarterIndex % 4 === 0) {
            rect.x = centerX - rect.width - gap / 2;
            rect.y = centerY - rect.height - gap / 2;
        }
        else if (quarterIndex % 4 === 1) {
            rect.x = gap / 2;
            rect.y = centerY - rect.height - gap / 2;
        }
        else if (quarterIndex % 4 === 2) {
            rect.x = gap / 2;
            rect.y = gap / 2;
        }
        else if (quarterIndex % 4 === 3) {
            rect.x = centerX - rect.width - gap / 2;
            rect.y = gap / 2;
        }
    }); console.log(rects);

    return rects;
}