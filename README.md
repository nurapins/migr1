# TEAM TEMP

## CSC316 Project Overview 

**The Real Cost of Travel** is a data visualization project that explores the global inequality of the Schengen visa system. While the Schengen visa is a significant advancement in international travel, its application process places a disproportionate financial and bureaucratic burden on citizens of developing nations. This project highlights the "visa-free" gap, the multi-million euro non-refundable fees paid by these nations, and the high refusal rates that often come with vague explanations.

By visualizing the relationship between passport power, economic status (local salaries), and visa success rates, we aim to shed light on the invisible barriers that restrict global mobility.

## Team Members
- **Nursultan Nurapin**
- **Yuelin Jiang**
- **Sumaid Lakho**

---

## Key Visualizations


### 🌍 Passport Privilege 
An interactive visualization that shows how much of the world opens up based on the passport you inherit. It displays visa-free scores and ranks countries by their passport power, illustrating the "birthright" nature of global travel privileges.

### Interactive Map
A dynamic map (heatmap) that visualizes the refusal rates by year of Schengen visa applications across the globe. Provides data on top 5 refusal rates each year, and how many tries it would take on average. 

### 💰 The Fee Received by EU
This section visualizes the financial contributions made by applicants from non-Schengen countries and how much each country earns from rejected visas. 

### 📊 Salary vs. Visa Cost Analysis
A visualization that compares the cost of a Schengen visa (€90) to the average monthly salaries in different countries. 

### 🕹️ Interactive Visa Simulator
An interactive tool that lets users experience the financial risk of applying for a Schengen visa.

---

## Data Sources

The project utilizes several datasets:

- **Schengen Visa Statistics**: Data on visa applications, approvals, and refusals by reporting state and consulate country from Kaggle. (Source: `data/visitor-visa-statistics.csv`)
- **Global Passport Power**: Rankings and visa-free scores for all countries. (Source: `data/passport_power_2023_ranked_with_birth_share.csv`)
- **Global Salary Data**: Average monthly salaries by country to calculate purchasing power parity for visa costs. (Source: `data/country_salaries.csv`)
- **World Geographic Data**: GeoJSON for mapping and spatial visualizations. (Source: `data/world.json`)

---

## Project Structure

```text
migr/
├── index.html          # Main application entry point
├── css/
│   └── style.css       # Custom styling and animations
├── js/
│   ├── main.js         # Main initialization and data loading
│   ├── mapVis.js       # Geographic visualizations
│   ├── feeVis.js       # Fee distribution visualizations
│   ├── salaryVis.js    # Salary-related visualizations
│   ├── salaryBarChart.js # Bar chart for salary comparisons
│   ├── visaSimulator.js # Interactive visa application simulation
│   └── passportPowerHook.js # Passport power visualization logic
├── data/
│   ├── visitor-visa-statistics.csv
│   ├── country_salaries.csv
│   ├── world.json
│   └── passport_power_2023_ranked_with_birth_share.csv
└── images/             # Icons (euro bills, backgrounds)
```

---

## License

This project was developed as part of a data visualization course. All data is sourced from public records and is intended for educational and awareness purposes.
