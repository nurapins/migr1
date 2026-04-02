class SalaryVis {
    constructor(parentElement, geoData, salaryData) {
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.salaryData = salaryData;
        this.selectedCountry = null;
        this.fee = 90; // Standard Schengen visa fee in EUR

        this.initVis();
    }

    initVis() {
        let vis = this;

        vis.margin = { top: 40, right: 40, bottom: 40, left: 40 };
        vis.container = d3.select("#" + vis.parentElement);
        
        // Dynamic sizing
        const containerRect = vis.container.node().getBoundingClientRect();
        vis.width = (containerRect.width || 800) - vis.margin.left - vis.margin.right;
        vis.height = 500 - vis.margin.top - vis.margin.bottom;

        vis.svg = vis.container.append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);

        // Projection for single country (will be updated per country)
        vis.projection = d3.geoMercator();
        vis.path = d3.geoPath().projection(vis.projection);

        // Placeholder group for country shape
        vis.countryGroup = vis.svg.append("g")
            .attr("class", "country-outline-group");

        // Definitions for gradients/clips
        vis.defs = vis.svg.append("defs");
    }

    updateCountry(countryName) {
        let vis = this;
        vis.selectedCountry = countryName;
        
        // Update UI text
        d3.select("#selected-country-name").text(countryName);
        
        const salaryInfo = vis.salaryData.find(d => d.country === countryName);
        if (salaryInfo) {
            const salary = salaryInfo.avg_salary;
            const percentage = Math.min(100, (vis.fee / salary) * 100);
            
            d3.select("#salary-value").text(`${salary} EUR`);
            
            const hoursPerDay = 8;
            const daysInMonth = 22; // approx working days
            const totalHoursInMonth = daysInMonth * hoursPerDay;
            const daysHours = (percentage / 100) * totalHoursInMonth;
            d3.select("#work-percentage").text(`${daysHours.toFixed(1)} Hours`);
            
            let desc = `In ${countryName}, a single visa application fee (€90) costs about <strong>${percentage.toFixed(1)}%</strong> of the average monthly income. `;
            desc += `That's equivalent to approximately <strong>${daysHours.toFixed(1)} hours</strong> of work just to pay for the application.`;
            d3.select("#salary-description").html(desc);
            
            vis.renderCountry(countryName, percentage, daysHours, true);

            // Return some info about the rendered country to help with the transition
            const feature = vis.geoData.features.find(d => d.properties.name === countryName);
            if (feature) {
                const bounds = vis.path.bounds(feature);
                const containerRect = vis.container.node().getBoundingClientRect();
                const svgRect = vis.svg.node().parentElement.getBoundingClientRect(); // The div#salary-vis
                
                return {
                    bounds: bounds,
                    svgRect: svgRect,
                    pathData: vis.path(feature)
                };
            }
        } else {
            d3.select("#salary-value").text("N/A");
            d3.select("#work-percentage").text("-");
            d3.select("#salary-description").text("Salary data not available for this country.");
            vis.countryGroup.selectAll("*").remove();
        }
        return null;
    }

    renderCountry(countryName, percentage, daysHours, skipAnimation = false) {
        let vis = this;

        // Find GeoJSON feature
        let feature = vis.geoData.features.find(d => d.properties.name === countryName);
        
        // Try fuzzy match if exact match fails
        if (!feature) {
            feature = vis.geoData.features.find(d => 
                d.properties.name.toLowerCase().includes(countryName.toLowerCase()) ||
                countryName.toLowerCase().includes(d.properties.name.toLowerCase())
            );
        }
        
        if (!feature) {
            console.error("No GeoJSON feature found for:", countryName);
            vis.countryGroup.selectAll("*").remove();
            d3.select("#salary-vis-fallback").style("display", "block").text(`Shape for ${countryName} not found.`);
            return;
        }

        d3.select("#salary-vis-fallback").style("display", "none");

        // Fit projection to this country with some padding
        vis.projection.fitSize([vis.width * 0.9, vis.height * 0.9], feature);
        
        vis.countryGroup.selectAll("*").remove();

        // Position country group in center
        vis.countryGroup.attr("transform", `translate(${vis.width * 0.05}, ${vis.height * 0.05})`);

        // Unique ID for clip path
        const clipId = "clip-" + countryName.replace(/[^a-z0-9]/gi, '-').toLowerCase() + "-" + Math.floor(Math.random() * 1000);
        
        vis.defs.selectAll(".salary-clip").remove();
        vis.defs.append("clipPath")
            .attr("id", clipId)
            .attr("class", "salary-clip")
            .append("path")
            .attr("d", vis.path(feature));

        // Background (full salary)
        const bgPath = vis.countryGroup.append("path")
            .datum(feature)
            .attr("d", vis.path)
            .attr("fill", "#1a1a1a");

        if (skipAnimation) {
            bgPath.style("opacity", 0);
        }

        // Calculate filling box
        // We want to fill from the bottom up
        const bounds = vis.path.bounds(feature);
        const yMin = bounds[0][1];
        const yMax = bounds[1][1];
        const h = yMax - yMin;

        const fillY = yMax - (h * (percentage / 100));

        // Fee part (filled from bottom)
        const feeRect = vis.countryGroup.append("rect")
            .attr("x", bounds[0][0])
            .attr("y", fillY)
            .attr("width", bounds[1][0] - bounds[0][0])
            .attr("height", Math.max(0, yMax - fillY))
            .attr("fill", "#f97316")
            .attr("clip-path", `url(#${clipId})`)
            .style("opacity", 0);
        
        if (!skipAnimation) {
            feeRect.transition().duration(1000).style("opacity", 0.9);
        }

        // Add the outline on top of everything
        const outlinePath = vis.countryGroup.append("path")
            .datum(feature)
            .attr("d", vis.path)
            .attr("fill", "none")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5)
            .style("opacity", 0);
        
        if (!skipAnimation) {
            outlinePath.transition().duration(1000).style("opacity", 0.4);
        }

        // Add a line at the split point
        const splitLine = vis.countryGroup.append("line")
            .attr("x1", bounds[0][0])
            .attr("y1", fillY)
            .attr("x2", bounds[1][0])
            .attr("y2", fillY)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,4")
            .attr("clip-path", `url(#${clipId})`)
            .style("opacity", 0);
        
        if (!skipAnimation) {
            splitLine.transition().duration(1000).style("opacity", 0.5);
        }
            
        // Label the fee part
        const feeLabel = vis.countryGroup.append("text")
            .attr("x", (bounds[0][0] + bounds[1][0]) / 2)
            .attr("y", fillY + (yMax - fillY) / 2)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("fill", "#ffffff")
            .style("font-size", "18px")
            .style("font-weight", "400")
            .style("pointer-events", "none")
            .style("text-shadow", "0 2px 4px rgba(0,0,0,0.5)")
            .text(`${percentage.toFixed(1)}% of the monthly salary`)
            .style("opacity", 0);
        
        if (!skipAnimation) {
            feeLabel.transition().duration(1000).style("opacity", 1);
        }

        vis.revealCountry = () => {
            bgPath.transition().duration(800).style("opacity", 1);
            feeRect.transition().duration(1200).style("opacity", 0.9);
            outlinePath.transition().duration(1200).style("opacity", 0.4);
            splitLine.transition().duration(1200).style("opacity", 0.5);
            feeLabel.transition().duration(1200).style("opacity", 1);
        };
    }

}
