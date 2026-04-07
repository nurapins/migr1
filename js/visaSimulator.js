class VisaSimulator {
    constructor(salaryData, visaData, schengenCountries, visaExemptCountries) {
        this.salaryData = salaryData;
        this.visaData = visaData;
        this.schengenCountries = schengenCountries;
        this.visaExemptCountries = visaExemptCountries;
        this.selectedCountry = null;
        this.totalSpent = 0;
        this.totalHoursSpent = 0;
        this.visaFee = 90;

        this.init();
    }

    init() {
        const vis = this;

        this.applyBtn = d3.select("#apply-visa-btn");
        this.moneyCounter = d3.select("#money-counter");
        this.workCounter = d3.select("#work-counter");
        this.simCountryLabel = d3.select("#sim-country");
        this.resultDiv = d3.select("#simulation-result");
        this.highRefusalList = d3.select("#high-refusal-list");

        this.applyBtn.on("click", () => this.applyForVisa());

        this.initHighRefusalList();
        this.updateUI();
    }

    setSelectedCountry(countryName) {
        if (this.selectedCountry === countryName) return;
        this.selectedCountry = countryName;
        this.totalSpent = 0;
        this.totalHoursSpent = 0;
        this.resultDiv.html("").classed("visible", false);
        this.updateUI();
    }

    initHighRefusalList() {
        const vis = this;
        // Get the latest year data
        const latestYear = d3.max(this.visaData, d => +d.reporting_year);
        const latestData = this.visaData.filter(d => +d.reporting_year === latestYear);

        // Sort by refusal rate and take top 10
        const highRefusalCountries = latestData
            .filter(d => 
                d.total_applications > 1000 && 
                !this.schengenCountries.has(d.consulate_country) && 
                !this.visaExemptCountries.has(d.consulate_country)
            ) 
            .sort((a, b) => b.refusal_rate - a.refusal_rate)
            .slice(0, 10);

        this.highRefusalList.selectAll(".country-pill")
            .data(highRefusalCountries)
            .enter()
            .append("div")
            .attr("class", "country-pill")
            .text(d => d.consulate_country)
            .on("click", (event, d) => {
                this.setSelectedCountry(d.consulate_country);
                // Also update other visualizations if they exist
                if (window.salaryVis) {
                    window.salaryVis.updateCountry(d.consulate_country);
                }
                if (window.mapVis) {
                    window.mapVis.selectCountry(d.consulate_country);
                }
            });
    }

    applyForVisa() {
        if (!this.selectedCountry) {
            this.resultDiv.html("<p class='error'>Please select a country on the globe first!</p>");
            return;
        }

        const countryVisaData = this.visaData.find(d => 
            d.consulate_country === this.selectedCountry && 
            +d.reporting_year === (window.currentYear || 2022)
        );

        if (!countryVisaData) {
            this.resultDiv.html(`<p class='error'>No visa data available for ${this.selectedCountry} in the selected year.</p>`);
            return;
        }

        const refusalRate = countryVisaData.refusal_rate;
        const random = Math.random() * 100;
        const success = random > refusalRate;

        this.totalSpent += this.visaFee;
        
        const salaryInfo = this.salaryData.find(d => d.country === this.selectedCountry);
        if (salaryInfo) {
            const monthlySalary = salaryInfo.avg_salary;
            const hourlyRate = monthlySalary / (22 * 8);
            this.totalHoursSpent += this.visaFee / hourlyRate;
        }

        if (success) {
            this.resultDiv.html(`
                <div class='result-status status-approved'>
                    APPROVED
                </div>
                <div class='result-reason'>Your visa for the Schengen Area has been issued. Click on another country to see what happens when rejected</div>
            `);
            this.applyBtn.property("disabled", true).text("Visa Obtained");
        } else {
            this.resultDiv.html(`
                <div class='result-status status-rejected'>
                    REFUSED
                </div>
                <div class='result-reason'>"The information submitted regarding the justification for the purpose and conditions of the intended stay was not reliable."</div>
            `);
        }
        this.resultDiv.classed("visible", true);

        this.updateUI();
    }

    updateUI() {
        this.simCountryLabel.text(this.selectedCountry || "the selected country");
        this.moneyCounter.text(`€${this.totalSpent}`);
        this.workCounter.text(`${this.totalHoursSpent.toFixed(1)}`);
        
        if (!this.selectedCountry) {
            this.applyBtn.text("Select a Country");
        } else if (!this.resultDiv.select(".status-approved").empty()) {
            this.applyBtn.text("Visa Obtained").property("disabled", true);
        } else {
            this.applyBtn.text(`Apply for a Visa (€${this.visaFee})`).property("disabled", false);
        }
    }
}
