class MapVis {
    constructor(parentElement, adjustedData, geoData, schengenCountries, visaExemptCountries) {
        this.parentElement = parentElement;
        this.adjustedData = adjustedData;
        this.geoData = geoData;
        this.schengenCountries = schengenCountries;
        this.visaExemptCountries = visaExemptCountries;

        // Will be set on each render
        this.yearLookup = new Map();
        this.colorScale = () => "#e6e6e6";

        this.initVis();
    }

    initVis() {
        let vis = this;

        vis.container = d3.select("#" + vis.parentElement);
        vis.width = vis.container.node().getBoundingClientRect().width - 32;
        vis.height = vis.container.node().getBoundingClientRect().height - 16;

        vis.svg = vis.container.append("svg")
            .attr("viewBox", `0 0 ${vis.width} ${vis.height}`);

        vis.animated = false;

        // ── Sphere ──
        vis.targetScale = Math.min(vis.width, vis.height) / 2.4;
        vis.projection = d3.geoOrthographic()
            .translate([vis.width / 2, vis.height / 2])
            .scale(0)
            .clipAngle(90)
            .rotate([-180, -30]);

        vis.path = d3.geoPath().projection(vis.projection);

        vis.glow = vis.svg.append("circle")
            .attr("fill", "url(#globe-glow-gradient)")
            .attr("cx", vis.width / 2)
            .attr("cy", vis.height / 2)
            .attr("r", 0)
            .style("opacity", 0);

        vis.globeBackground = vis.svg.append("path")
            .datum({ type: "Sphere" })
            .attr("stroke", "#333333")
            .attr("d", vis.path)
            .style("opacity", 0);

        // ── Graticule ──
        vis.graticule = d3.geoGraticule();
        vis.graticulePath = vis.svg.append("path")
            .datum(vis.graticule())
            .attr("fill", "none")
            .attr("stroke", "rgba(255, 255, 255, 0.05)")
            .attr("stroke-width", 0.4)
            .attr("d", vis.path)
            .style("opacity", 0);

        // ── Tooltip ──
        vis.tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("transition", "opacity 0.2s ease");

        // ── Countries ──
        vis.mapFeatures = vis.geoData.features;

        vis.countries = vis.svg.append("g")
            .selectAll(".country")
            .data(vis.mapFeatures)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", vis.path)
            .attr("fill", "#1a1a1a")
            .style("opacity", 0);

        // ── Plane (Loading animation) ──
        vis.plane = vis.svg.append("path")
            .attr("class", "plane")
            .attr("d", "M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,18.5L8,20L8,21L11.5,20L15,21L15,20L13,18.5L13,13.5L21,16Z")
            .attr("fill", "#f97316")
            .attr("stroke", "white")
            .attr("stroke-width", 0.5)
            .style("filter", "drop-shadow(0 0 5px rgba(249, 115, 22, 0.8))")
            .style("opacity", 0)
            .style("pointer-events", "none");

        // ── Interactivity (Rotation & Zoom) ──
        vis.svg.call(d3.drag()
            .on("drag", (event) => {
                const rotate = vis.projection.rotate();
                const k = 75 / Math.max(1, vis.projection.scale());
                vis.projection.rotate([
                    rotate[0] + event.dx * k,
                    rotate[1] - event.dy * k
                ]);
                vis.updatePaths();
            }));

        vis.updatePaths = () => {
            const translate = vis.projection.translate();
            vis.glow
                .attr("cx", translate[0])
                .attr("cy", translate[1]);
            vis.globeBackground.attr("d", vis.path);
            vis.graticulePath.attr("d", vis.path);
            vis.countries.attr("d", vis.path);

            if (vis.planePos) {
                const pos = vis.projection(vis.planePos);
                const rotate = vis.projection.rotate();
                const center = [-rotate[0], -rotate[1]];
                const distance = d3.geoDistance(vis.planePos, center);
                const isVisible = distance < Math.PI / 2;

                if (isVisible && vis.projection.scale() > 0) {
                    // Orientation: the plane SVG is 24x24, nose at top. 
                    // We rotate and center it.
                    vis.plane
                        .attr("transform", `translate(${pos[0]}, ${pos[1]}) scale(0.5) rotate(75) translate(-12, -12)`)
                        .style("opacity", 1);
                } else {
                    vis.plane.style("opacity", 0);
                }
            }
        };

        // Bind mouse events once — they read live state from `vis`
        vis.countries
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .transition().duration(150)
                    .attr("stroke", "#f97316")
                    .attr("stroke-width", 1.6);

                vis.tooltip
                    .style("opacity", 1)
                    .style("left", `${event.pageX + 16}px`)
                    .style("top", `${event.pageY - 20}px`)
                    .html(vis.getTooltipHTML(d.properties.name, vis.yearLookup));

                // Update result box on hover instead of click
                const resultDiv = d3.select("#click-result");
                const suggestionDiv = d3.select("#click-suggestion");

                // Stop any ongoing suggestion transitions and hide it
                suggestionDiv.interrupt().transition().duration(400).style("opacity", 0);

                resultDiv.style("display", "block")
                    .html(vis.getResultHTML(d))
                    .transition().duration(400).style("opacity", 1);
            })
            .on("mousemove", function (event) {
                vis.tooltip
                    .style("left", `${event.pageX + 16}px`)
                    .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition().duration(300)
                    .attr("stroke", "#1a1a1a")
                    .attr("stroke-width", 0.5);

                vis.tooltip
                    .style("opacity", 0)
                    .html("");
            })
            .on("click", function (event, d) {
                const countryName = d.properties.name;
                
                // Highlight selected country on the globe
                vis.countries.attr("stroke", "#1a1a1a").attr("stroke-width", 0.5); // Reset others
                d3.select(this)
                    .transition().duration(300)
                    .attr("stroke", "#f97316")
                    .attr("stroke-width", 2);

                // Update Salary Visualization ONLY if Visa required (non-Schengen, non-visa free, has data)
                const category = vis.getCountryCategory(countryName, vis.yearLookup);
                if (window.salaryVis && category === "Visa required") {
                    // Start the fly transition
                    vis.flyToSalary(d, this);
                }

                if (window.visaSimulator) {
                    window.visaSimulator.setSelectedCountry(countryName);
                }
            });

        // ── Gradient legend ──
        vis.legendWidth = 220;
        vis.legendHeight = 14;

        vis.legend = vis.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(32, ${vis.height - 50})`)
            .style("opacity", 0);

        vis.legendDefs = vis.svg.append("defs");

        // ── Globe depth gradient ──
        vis.globeGradient = vis.legendDefs.append("radialGradient")
            .attr("id", "globe-gradient")
            .attr("cx", "35%").attr("cy", "35%").attr("r", "60%");
        vis.globeGradient.append("stop").attr("offset", "0%").attr("stop-color", "#1a1a1a");
        vis.globeGradient.append("stop").attr("offset", "100%").attr("stop-color", "#000000");

        // Subtle orange glow behind globe
        vis.globeGlowGradient = vis.legendDefs.append("radialGradient")
            .attr("id", "globe-glow-gradient")
            .attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
        vis.globeGlowGradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(249, 115, 22, 0.35)");
        vis.globeGlowGradient.append("stop").attr("offset", "70%").attr("stop-color", "rgba(249, 115, 22, 0.28)");
        vis.globeGlowGradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0, 0, 0, 0)");

        vis.globeBackground.attr("fill", "url(#globe-gradient)");

        vis.legendGradient = vis.legendDefs.append("linearGradient")
            .attr("id", "refusal-gradient")
            .attr("x1", "0%").attr("x2", "100%")
            .attr("y1", "0%").attr("y2", "0%");

        vis.legendRect = vis.legend.append("rect")
            .attr("width", vis.legendWidth)
            .attr("height", vis.legendHeight)
            .attr("rx", 3)
            .attr("stroke", "#333333");

        vis.legendAxisGroup = vis.legend.append("g")
            .attr("class", "legend-axis")
            .attr("transform", `translate(0, ${vis.legendHeight})`);

        vis.legendLabel = vis.legend.append("text")
            .attr("class", "legend-label")
            .attr("x", 0).attr("y", -8)
            .text("Refusal rate");

        // ── Category legend (positioned relative to height) ──
        vis.categoryLegend = vis.svg.append("g")
            .attr("class", "category-legend")
            .attr("transform", `translate(32, ${vis.height - 145})`)
            .style("opacity", 0);

        const categoryItems = [
            { label: "Schengen", color: "#166af9" },
            { label: "Visa-free", color: "#4b5563" },
            { label: "No data", color: "#1a1a1a" }
        ];

        const categoryRows = vis.categoryLegend.selectAll(".category-row")
            .data(categoryItems)
            .enter()
            .append("g")
            .attr("class", "category-row")
            .attr("transform", (d, i) => `translate(0, ${i * 22})`);

        categoryRows.append("rect")
            .attr("width", 14).attr("height", 14)
            .attr("rx", 3)
            .attr("fill", d => d.color)
            .attr("stroke", "#333333");

        categoryRows.append("text")
            .attr("x", 22).attr("y", 11)
            .style("font-family", "'Plus Jakarta Sans', sans-serif")
            .style("font-size", "11px")
            .style("fill", "#9ca3af")
            .text(d => d.label);

        // ── Top 5 panel (glassmorphism) ──
        vis.topFiveGroup = vis.svg.append("g")
            .attr("class", "top-five-group")
            .attr("transform", `translate(${vis.width - 240}, 60)`)
            .style("opacity", 0);

        vis.topFiveGroup.append("rect")
            .attr("class", "top-five-bg")
            .attr("width", 220).attr("height", 160)
            .attr("fill", "rgba(10, 10, 10, 0.85)")
            .attr("stroke", "rgba(255, 255, 255, 0.1)")
            .attr("rx", 10);

        vis.topFiveTitle = vis.topFiveGroup.append("text")
            .attr("class", "top-five-title")
            .attr("x", 14).attr("y", 24)
            .text("Top 5 refusal rates");

        vis.topFiveList = vis.topFiveGroup.append("g")
            .attr("class", "top-five-list")
            .attr("transform", "translate(14, 48)");
    }

    // ── Data helpers ──

    getYearLookup(year) {
        const yearData = this.adjustedData.filter(d => +d.reporting_year === +year);
        return new Map(yearData.map(d => [d.consulate_country, d]));
    }

    getCountryCategory(name, yearLookup) {
        if (this.schengenCountries.has(name)) return "Schengen";
        if (this.visaExemptCountries.has(name)) return "Visa-free";
        if (yearLookup.has(name)) return "Visa required";
        return "No data";
    }

    getCountryFill(name, yearLookup, colorScale) {
        if (this.schengenCountries.has(name)) return "#166af9";
        if (this.visaExemptCountries.has(name)) return "#4b5563";
        const info = yearLookup.get(name);
        if (info) return colorScale(info.refusal_rate);
        return "#1a1a1a";
    }

    getTooltipHTML(name, yearLookup) {
        const info = yearLookup.get(name);
        const category = this.getCountryCategory(name, yearLookup);

        let html = `<strong>${name}</strong><br>Category: ${category}`;

        if (category === "Visa required" && info) {
            html += `
                <br>Applications: ${d3.format(",")(info.total_applications)}
                <br>Issued: ${d3.format(",")(info.total_issued)}
                <br>Not issued: ${d3.format(",")(info.total_not_issued)}
                <br>Refusal rate: ${info.refusal_rate.toFixed(1)}%
            `;
        }
        return html;
    }

    getResultHTML(d) {
        const vis = this;
        const countryName = d.properties.name;
        const category = vis.getCountryCategory(countryName, vis.yearLookup);
        
        if (category !== "Visa required") {
            if (category === "Schengen") {
                return `<strong>${countryName}</strong> is part of the Schengen Area. Residents do not need a visa to travel within the area.`;
            } else if (category === "Visa-free") {
                return `Citizens of <strong>${countryName}</strong> enjoy visa-free travel to the Schengen Area.`;
            } else {
                return `<strong>${countryName}</strong>: Sorry, we don't have enough data for this country in the selected year.`;
            }
        }

        const countryData = vis.yearLookup.get(countryName);
        const refusalRate = countryData.refusal_rate;
        const successRate = 100 - refusalRate;
    
        const expectedTries = successRate > 0 ? (100 / successRate) : "∞";
        const triesStr = typeof expectedTries === "number" ? 
            (expectedTries === 1 ? "1" : expectedTries.toFixed(1)) : "∞";

        const costPerTry = 90;
        const totalCostValue = typeof expectedTries === "number" ? (expectedTries * costPerTry) : null;
        const totalCostStr = totalCostValue !== null ? `${d3.format(",.0f")(totalCostValue)} euros` : "a lot of euros";

        let resultMsg = "";
        if (countryName === "Russia") {
            resultMsg = `<strong>${countryName}</strong>: its just too big.<br><br>`;
        }

        resultMsg += `
            If you were from <strong>${countryName}</strong>, your chance of traveling to a Schengen country would be 
            <strong>${(successRate).toFixed(1)}%</strong> (refusal rate: ${(refusalRate).toFixed(1)}%). 
            <br><br>
            Due to these odds, it would statistically take you <strong>${triesStr} ${expectedTries === 1 ? 'try' : 'tries'}</strong> to get a visa. 
            Since application fees are non-refundable, this would cost you approximately <strong>${totalCostStr}</strong> 
            before you even begin your journey.
        `;
        
        return resultMsg;
    }

    // ── Legend (animated axis) ──

    updateLegend(minRate, maxRate) {
        let vis = this;

        vis.legendGradient.selectAll("stop").remove();

        d3.range(0, 1.01, 0.1).forEach(t => {
            vis.legendGradient.append("stop")
                .attr("offset", `${t * 100}%`)
                .attr("stop-color", d3.interpolateRgb("#2ecc71", "#e74c3c")(t));
        });

        vis.legendRect.attr("fill", "url(#refusal-gradient)");

        const legendScale = d3.scaleLinear()
            .domain([minRate, maxRate])
            .range([0, vis.legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .tickSize(4)
            .ticks(5)
            .tickFormat(d => d.toFixed(1) + "%");

        vis.legendAxisGroup
            .transition().duration(600)
            .call(legendAxis);
    }

    // ── Top 5 (animated rows) ──

    updateTopFive(yearLookup) {
        let vis = this;

        const topFive = Array.from(yearLookup.values())
            .filter(d =>
                d.total_applications > 0 &&
                !vis.schengenCountries.has(d.consulate_country) &&
                !vis.visaExemptCountries.has(d.consulate_country)
            )
            .sort((a, b) => d3.descending(a.refusal_rate, b.refusal_rate))
            .slice(0, 5);

        const rows = vis.topFiveList.selectAll(".top-five-row")
            .data(topFive, d => d.consulate_country);

        // EXIT — fade out then remove
        rows.exit()
            .transition().duration(300)
            .style("opacity", 0)
            .remove();

        // ENTER
        const rowsEnter = rows.enter()
            .append("g")
            .attr("class", "top-five-row")
            .style("opacity", 0);

        rowsEnter.append("text")
            .attr("class", "top-five-text");

        // ENTER + UPDATE — slide to position, fade in
        const merged = rows.merge(rowsEnter);

        merged
            .transition().duration(600).ease(d3.easeCubicOut)
            .attr("transform", (d, i) => `translate(0, ${i * 20})`)
            .style("opacity", 1);

        merged.select(".top-five-text")
            .text((d, i) => `${i + 1}. ${d.consulate_country} — ${d.refusal_rate.toFixed(1)}%`);
    }

    // ── Main render (animated) ──

    render(year) {
        let vis = this;

        // Only animate title if the entrance animation has played
        if (vis.animated) {
            d3.select(".map-main-title")
                .transition("title-fade").duration(400)
                .style("opacity", 0)
                .transition("title-fade").duration(400)
                .text(`Visa Barriers & Lost Fees, ${year}`)
                .style("opacity", 1);
        } else {
            d3.select(".map-main-title").text(`Visa Barriers & Lost Fees, ${year}`);
        }

        // Update shared state so hover handlers read fresh data
        vis.yearLookup = vis.getYearLookup(year);

        const refusalRates = Array.from(vis.yearLookup.values())
            .map(d => d.refusal_rate)
            .filter(d => d != null && !isNaN(d));

        const minRate = d3.min(refusalRates);
        const maxRate = d3.max(refusalRates);

        vis.colorScale = d3.scaleSequential()
            .domain([minRate, maxRate])
            .interpolator(d3.interpolateRgb("#2ecc71", "#e74c3c"));

        // Animate country fills
        vis.countries
            .transition("color-update").duration(800).ease(d3.easeCubicInOut)
            .attr("fill", d => vis.getCountryFill(d.properties.name, vis.yearLookup, vis.colorScale));

        vis.updateLegend(minRate, maxRate);
        vis.updateTopFive(vis.yearLookup);
    }

    enterAnimation() {
        let vis = this;
        if (vis.animated) return;
        vis.animated = true;

        // 1. Reveal globe sphere & graticule
        vis.globeBackground.transition("entrance").duration(800).style("opacity", 1);
        vis.graticulePath.transition("entrance").duration(800).style("opacity", 1);

        // 2. Animate scale and rotation
        d3.transition("entrance-tween")
            .duration(2400)
            .ease(d3.easeCubicOut)
            .tween("entrance", () => {
                const iScale = d3.interpolate(0, vis.targetScale);
                const iRotate = d3.interpolate([-180, -30], [0, 0]);
                return (t) => {
                    vis.projection.scale(iScale(t));
                    vis.projection.rotate(iRotate(t));
                    vis.updatePaths();
                };
            });

        // 3. Staggered country reveal
        vis.countries
            .transition("entrance")
            .delay((d, i) => 800 + i * 2)
            .duration(1200)
            .style("opacity", 1);

        d3.select(".map-main-title")
            .transition("entrance")
            .delay(1800)
            .duration(1000)
            .style("opacity", 1)
            .style("transform", "translateY(0)");

        // 4. Reveal UI elements, title, and external controls
        const uiElements = [vis.legend, vis.categoryLegend, vis.topFiveGroup];
        uiElements.forEach((el, i) => {
            el.transition("entrance")
                .delay(1000 + i * 200)
                .duration(1000)
                .style("opacity", 1);
        });

        d3.select(".map-controls")
            .transition("entrance")
            .delay(2800)
            .duration(1000)
            .style("opacity", 1)
            .style("transform", "translateY(0)");
            
        d3.select(".click-suggestion")
            .transition("entrance")
            .delay(300)
            .duration(3000)
            .style("opacity", 1);

        d3.select(".click-suggestion")
            .transition("change-suggestion")
            .delay(3000)
            .duration(1000)
            .style("opacity", 0)
            .on("end", function() {
                d3.select(this)
                    .html('<span class="pulse-dot"></span> Suggestion: Click on a country to see the financial impact of your application')
                    .transition()
                    .duration(1000)
                    .style("opacity", 1)
                    .transition()
                    .delay(2500)
                    .duration(1000)
                    .style("opacity", 0);
            });

        // 5. Subtle glow reveal AFTER main animation
        vis.glow
            .transition("entrance-glow")
            .delay(1000)
            .duration(1000)
            .attr("r", vis.targetScale * 1.35)
            .style("opacity", 1)
            .transition("glow-settle")
            .delay(400) // 2000 + 1000 + 400 = 3400ms
            .duration(1200)
            .style("opacity", 0.55);

        // 6. Plane loading animation
        d3.transition("plane-entrance")
            .delay(400)
            .duration(5000)
            .ease(d3.easeCubicInOut)
            .tween("plane", () => {
                const iLon = d3.interpolate(-170, 90);
                const iLat = d3.interpolate(-20, 30);
                return (t) => {
                    vis.planePos = [iLon(t), iLat(t)];
                    vis.updatePaths();
                };
            })
            .on("end", () => {
                vis.planePos = null;
                vis.plane.transition().duration(1000).style("opacity", 0);
            });
    }

    flyToSalary(feature, countryPathNode) {
        const vis = this;
        const countryName = feature.properties.name;

        // Cleanup any existing overlays
        d3.selectAll(".flying-overlay").remove();

        // 1. Prepare SalaryVis but don't show the country yet
        const salaryData = window.salaryVis.updateCountry(countryName);
        if (!salaryData) return;

        // 2. Setup the flying clone
        const body = d3.select("body");
        
        // Use absolute positioning relative to body for more reliable animation during scroll
        const overlay = body.append("svg")
            .attr("class", "flying-overlay")
            .style("position", "absolute")
            .style("top", 0)
            .style("left", 0)
            .style("width", "100%")
            .style("height", d3.select("html").node().scrollHeight + "px")
            .style("pointer-events", "none")
            .style("z-index", 9999);

        const startRect = countryPathNode.getBoundingClientRect();
        const startPathData = d3.select(countryPathNode).attr("d");
        
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const flyingPath = overlay.append("path")
            .attr("d", startPathData)
            .attr("fill", vis.getCountryFill(countryName, vis.yearLookup, vis.colorScale))
            .attr("stroke", "#f97316")
            .attr("stroke-width", 2)
            .style("filter", "drop-shadow(0 0 8px rgba(249, 115, 22, 0.8))")
            .attr("transform", `translate(${startRect.left + scrollX}, ${startRect.top + scrollY})`);

        // 3. Scroll to the salary section
        const targetSection = document.getElementById('salary-vis-section');
        targetSection.scrollIntoView({ behavior: 'smooth' });

        // 4. Animate the flying path
        const targetRect = salaryData.svgRect;
        const targetX = targetRect.left + scrollX + window.salaryVis.margin.left + (window.salaryVis.width * 0.05);
        const targetTop = targetRect.top + scrollY + window.salaryVis.margin.top + (window.salaryVis.height * 0.05);

        flyingPath.transition()
            .duration(1500) // Slightly longer to match smooth scroll
            .ease(d3.easeCubicInOut)
            .attr("d", salaryData.pathData)
            .attr("transform", `translate(${targetX}, ${targetTop})`)
            .style("opacity", 0.9)
            .on("end", () => {
                // 5. Reveal the actual country in SalaryVis and remove the clone
                window.salaryVis.revealCountry();
                overlay.transition().duration(500).style("opacity", 0).remove();
            });
    }

    selectCountry(countryName) {
        const vis = this;
        vis.countries.attr("stroke", "#1a1a1a").attr("stroke-width", 0.5);
        
        vis.countries.filter(d => d.properties.name === countryName)
            .transition().duration(300)
            .attr("stroke", "#f97316")
            .attr("stroke-width", 2);
    }
}