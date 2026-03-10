# CSC Interoperability Event 2026 - Scenario Mapping

This project provides a mapping of EUDI Wallet participants to Cloud Signature Consortium (CSC) interoperability scenarios. It includes a directory of participants and a summary table showing scenario coverage.

## Features

- **Directory View**: A searchable grid of all participating organizations and their roles.
- **Summary Table**: A detailed matrix mapping organizations to specific CSC scenarios (API-01, API-02, etc.).
- **Scenario Filtering**: Filter the view by "Core" or "Advanced" CSC scenarios.
- **Search**: Interactive search by company name, contact, or participant.
- **Full Width Toggle**: Expand the summary table to fill the screen for better readability.

## Project Structure

- `index.html`: The main user interface.
- `app.js`: Application logic, routing, and data rendering.
- `style.css`: Modern, glassmorphic UI styles.
- `data.json`: The processed participant data.
- `results.csv`: Current scenario execution results (Pass/Partial/Issue).
- `fetch.js`: Puppeteer script to fetch data from Jotform.
- `preprocess.js`: Script to process raw responses into `data.json`.

## Routing & Navigation

The application uses hash-less routing logic to switch between views:

- **Directory View (Default)**: `http://localhost:3000/`
- **Summary Table View**: `http://localhost:3000/coverage-test`
- **Alternate Toggle**: You can also use `?view=table` to force the table view.

## Development & Running

### Prerequisites
- Node.js installed locally.

### Serving the project
The easiest way to run the project is using `npx serve`. For the routing to work correctly, use the single-page application flag:
```bash
npx serve -s .
```

### Data Pipeline
1. **Fetch**: Update the raw data from Jotform.
   ```bash
   npx node fetch.js
   ```
2. **Preprocess**: Map the responses to the `data.json` format.
   ```bash
   npx node preprocess.js
   ```

### VS Code Run Configurations
Three run configurations are included in `.vscode/launch.json`:
1. **Serve Project (npx serve)**: Hosts the site locally.
2. **Run fetch.js (Puppeteer)**: Runs the data collection script.
3. **Run preprocess.js**: Runs the data processing script.
