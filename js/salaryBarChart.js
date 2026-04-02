class SalaryBarChart {
    constructor(parentElement, salaryData, visaData, schengenCountries, visaExemptCountries) {
        this.parentElement = parentElement;
        this.salaryData = salaryData;
        this.visaData = visaData;
        
        // Use the same country name mapping as in main.js
        this.countryNameMap = {
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

        // Normalize sets for case-insensitive lookup
        this.schengenCountries = new Set(Array.from(schengenCountries).map(d => d.toLowerCase()));
        this.visaExemptCountries = new Set(Array.from(visaExemptCountries).map(d => d.toLowerCase()));
        
        this.showAllCountries = false; // Toggleable variable as requested
        this.fee = 90;

        this.currentView = 'continents'; // 'continents' or 'countries'
        this.currentContinent = null;

        // Button listener
        d3.select("#back-to-continents").on("click", () => this.backToContinents());

        this.initVis();
    }

    initVis() {
        let vis = this;

        vis.margin = { top: 50, right: 30, bottom: 180, left: 100 };
        vis.container = d3.select("#" + vis.parentElement);
        
        const containerRect = vis.container.node().getBoundingClientRect();
        vis.width = (containerRect.width || 1000) - vis.margin.left - vis.margin.right;
        vis.height = (containerRect.height || 600) - vis.margin.top - vis.margin.bottom;

        vis.svgElement = vis.container.append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom);
            
        vis.svg = vis.svgElement.append("g")
            .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);
            
        vis.svgElement.on("click", (event) => {
            if (vis.currentView === 'countries') {
                vis.backToContinents();
            }
        });

        // Scales
        vis.x = d3.scaleBand()
            .range([0, vis.width])
            .padding(0.3);

        vis.y = d3.scaleLinear()
            .range([vis.height, 0]);

        // Axes
        vis.xAxis = d3.axisBottom(vis.x);
        vis.yAxis = d3.axisLeft(vis.y).ticks(10).tickFormat(d => "€" + d);

        vis.xAxisGroup = vis.svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${vis.height})`);

        vis.yAxisGroup = vis.svg.append("g")
            .attr("class", "y-axis");

        vis.visaFeeLabel = vis.svg.append("text")
            .attr("class", "visa-fee-label")
            .attr("text-anchor", "end")
            .attr("x", -10)
            .attr("fill", "#f97316")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .text("Visa Fee");

        vis.visaFeeLine = vis.svg.append("line")
            .attr("class", "visa-fee-line")
            .attr("x1", 0)
            .attr("x2", vis.width)
            .attr("stroke", "#f97316")
            .attr("stroke-dasharray", "4,4")
            .attr("stroke-width", 1)
            .style("opacity", 0);

        // Tooltip
        vis.tooltip = d3.select("body").append("div")
            .attr("class", "chart-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "#fff")
            .style("padding", "10px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("z-index", "1000");

        // Labels
        vis.yLabel = vis.svg.append("text")
            .attr("class", "y-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -60)
            .attr("x", -vis.height / 2)
            .attr("fill", "#9ca3af")
            .text("Average Monthly Salary (EUR)");

        vis.xLabel = vis.svg.append("text")
            .attr("class", "x-label")
            .attr("text-anchor", "middle")
            .attr("y", vis.height + 130)
            .attr("x", vis.width / 2)
            .attr("fill", "#9ca3af")
            .text("Continents");

        // Process Data
        vis.wrangleData();
    }

    wrangleData() {
        let vis = this;

        // 1. Aggregating Visa Data by Country
        const countryVisaStats = d3.rollups(
            vis.visaData.filter(d => d.consulate_country),
            v => {
                const totalApps = d3.sum(v, d => d.visitor_visa_applications || 0);
                const totalNotIssued = d3.sum(v, d => d.visitor_visa_not_issued || 0);
                const region = v[0].consulate_country_region;
                return {
                    refusalRate: totalApps > 0 ? (totalNotIssued / totalApps) : 0,
                    region: region,
                    totalApps: totalApps
                };
            },
            d => {
                const raw = d.consulate_country.trim();
                return vis.countryNameMap[raw] || raw;
            }
        );

        vis.countryInfo = new Map();
        countryVisaStats.forEach(([country, stats]) => {
            const countryLower = country.trim().toLowerCase();
            const salaryItem = vis.salaryData.find(s => s.country.trim().toLowerCase() === countryLower);
            if (salaryItem && !vis.schengenCountries.has(countryLower) && !vis.visaExemptCountries.has(countryLower)) {
                vis.countryInfo.set(country, {
                    ...stats,
                    salary: +salaryItem.avg_salary,
                    country: country
                });
            }
        });

        // 2. Aggregate by Continent (Region)
        const continentStats = d3.rollups(
            Array.from(vis.countryInfo.values()),
            v => d3.mean(v, d => d.salary),
            d => d.region
        );

        vis.continentData = continentStats.map(([region, avgSalary]) => ({
            name: region,
            salary: avgSalary
        })).sort((a, b) => b.salary - a.salary);

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        let displayData;
        if (vis.currentView === 'continents') {
            displayData = vis.continentData;
            vis.xLabel.text("Continents (Click a bar to see countries)");
            d3.select("#back-to-continents").style("display", "none");
        } else {
            // Filter countries by continent
            let countries = Array.from(vis.countryInfo.values())
                .filter(d => d.region === vis.currentContinent);
            
            // Apply filtering logic
            if (!vis.showAllCountries) {
                countries = countries
                    .sort((a, b) => b.refusalRate - a.refusalRate)
                    .slice(0, 20);
                vis.xLabel.text(`Countries in ${vis.currentContinent} by Monthly Salary`);
            } else {
                vis.xLabel.text(`All Countries in ${vis.currentContinent}`);
            }

            // Always sort by salary descending for the visual display
            countries.sort((a, b) => b.salary - a.salary);

            displayData = countries.map(d => ({
                name: d.country,
                salary: d.salary,
                refusalRate: d.refusalRate
            }));

            d3.select("#back-to-continents").style("display", "block");
        }

        vis.svgElement.style("cursor", vis.currentView === 'countries' ? "pointer" : "default");

        vis.x.domain(displayData.map(d => d.name));
        vis.y.domain([0, d3.max(displayData, d => d.salary) * 1.1]);

        // Update Axes
        vis.xAxisGroup.transition().duration(800).call(vis.xAxis)
            .selectAll("text")
            .attr("transform", "translate(0,0), rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "11px");
        
        vis.yAxisGroup.transition().duration(800).call(vis.yAxis);

        vis.visaFeeLabel.transition().duration(800)
            .attr("y", vis.y(vis.fee) + 5)
            .style("opacity", (vis.y.domain()[1] >= vis.fee) ? 1 : 0);

        vis.visaFeeLine.transition().duration(800)
            .attr("y1", vis.y(vis.fee))
            .attr("y2", vis.y(vis.fee))
            .style("opacity", (vis.y.domain()[1] >= vis.fee) ? 0.5 : 0);

        // Join Main Bar (Salary MINUS fee)
        const bars = vis.svg.selectAll(".salary-bar")
            .data(displayData, d => d.name);

        bars.exit().transition().duration(800)
            .attr("y", vis.height)
            .attr("height", 0)
            .remove();

        const barsEnter = bars.enter().append("rect")
            .attr("class", "salary-bar")
            .attr("x", d => vis.x(d.name))
            .attr("y", vis.height)
            .attr("width", vis.x.bandwidth())
            .attr("height", 0)
            .on("click", (event, d) => {
                if (vis.currentView === 'continents') {
                    event.stopPropagation();
                    vis.drillDown(d.name);
                }
            })
            .on("mouseover", (event, d) => {
                vis.tooltip.transition().duration(200).style("opacity", 0.9);
                const pct = (vis.fee / d.salary * 100).toFixed(1);
                let content = `<div style="text-align: center;"><strong>${d.name}</strong></div><hr style="margin: 5px 0; border-color: rgba(255,255,255,0.2);">`;
                content += `Avg. Salary: <span style="color: #2ECC71FF;">€${d.salary.toFixed(0)}</span><br/>`;
                if (d.refusalRate !== undefined) {
                    content += `Visa Refusal Rate: <span style="color: #f97316;">${(d.refusalRate * 100).toFixed(1)}%</span><br/>`;
                }
                content += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">`;
                content += `<strong>Schengen Visa Fee:</strong> €${vis.fee}<br/>`;
                content += `Cost as % of Salary: <span style="color: #f97316; font-weight: bold;">${pct}%</span>`;
                content += `</div>`;
                
                vis.tooltip.html(content)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                vis.tooltip.transition().duration(500).style("opacity", 0);
            });

        barsEnter.merge(bars)
            .transition().duration(800)
            .attr("x", d => vis.x(d.name))
            .attr("width", vis.x.bandwidth())
            .attr("y", d => vis.y(d.salary))
            .attr("height", d => Math.max(0, vis.y(Math.min(d.salary, vis.fee)) - vis.y(d.salary)))
            .attr("cursor", "pointer")
            .attr("fill", vis.currentView === 'continents' ? "#96b2e6" : "#4e80dc");

        // Join Fee Segment
        const feeBars = vis.svg.selectAll(".fee-bar")
            .data(displayData, d => d.name);

        feeBars.exit().transition().duration(800)
            .attr("y", vis.height)
            .attr("height", 0)
            .remove();

        const feeBarsEnter = feeBars.enter().append("rect")
            .attr("class", "fee-bar")
            .attr("x", d => vis.x(d.name))
            .attr("y", vis.height)
            .attr("width", vis.x.bandwidth())
            .attr("height", 0)
            .attr("fill", "#f97316") // Red for the fee
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (vis.currentView === 'continents') {
                    event.stopPropagation();
                    vis.drillDown(d.name);
                }
            })
            .on("mouseover", (event, d) => {
                vis.tooltip.transition().duration(200).style("opacity", 0.9);
                const pct = (vis.fee / d.salary * 100).toFixed(1);
                let content = `<div style="text-align: center;"><strong>${d.name}</strong></div><hr style="margin: 5px 0; border-color: rgba(255,255,255,0.2);">`;
                content += `Avg. Salary: <span style="color: #4ade80;">€${d.salary.toFixed(0)}</span><br/>`;
                if (d.refusalRate !== undefined) {
                    content += `Visa Refusal Rate: <span style="color: #f97316;">${(d.refusalRate * 100).toFixed(1)}%</span><br/>`;
                }
                content += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">`;
                content += `<strong>Schengen Visa Fee:</strong> €${vis.fee}<br/>`;
                content += `Cost as % of Salary: <span style="color: #f97316; font-weight: bold;">${pct}%</span>`;
                content += `</div>`;
                
                vis.tooltip.html(content)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                vis.tooltip.transition().duration(500).style("opacity", 0);
            });

        feeBarsEnter.merge(feeBars)
            .transition().duration(800)
            .attr("x", d => vis.x(d.name))
            .attr("width", vis.x.bandwidth())
            .attr("y", d => vis.y(Math.min(d.salary, vis.fee)))
            .attr("height", d => vis.height - vis.y(Math.min(d.salary, vis.fee)));

        // Join Fee Labels
        const feeLabels = vis.svg.selectAll(".fee-label")
            .data(displayData, d => d.name);

        feeLabels.exit().transition().duration(800)
            .attr("y", vis.height)
            .style("opacity", 0)
            .remove();

        const feeLabelsEnter = feeLabels.enter().append("text")
            .attr("class", "fee-label")
            .attr("text-anchor", "middle")
            .attr("x", d => vis.x(d.name) + vis.x.bandwidth() / 2)
            .attr("y", vis.height)
            .attr("fill", "white")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("pointer-events", "none")
            .style("opacity", 0);

        feeLabelsEnter.merge(feeLabels)
            .transition().duration(800)
            .attr("x", d => vis.x(d.name) + vis.x.bandwidth() / 2)
            .attr("y", d => {
                const feeTop = vis.y(Math.min(d.salary, vis.fee));
                const feeBottom = vis.height;
                const barHeight = feeBottom - feeTop;
                return feeTop + barHeight / 2 + 4;
            })
            .text(d => (vis.fee / d.salary * 100).toFixed(1) + "%")
            .style("opacity", d => {
                const feeTop = vis.y(Math.min(d.salary, vis.fee));
                const barHeight = vis.height - feeTop;
                return (vis.x.bandwidth() > 25 && barHeight > 15) ? 1 : 0;
            });
    }

    drillDown(continent) {
        this.currentView = 'countries';
        this.currentContinent = continent;
        this.updateVis();
    }

    backToContinents() {
        this.currentView = 'continents';
        this.currentContinent = null;
        this.updateVis();
    }
}
