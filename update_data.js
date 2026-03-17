const fs = require('fs');
const path = require('path');

const technicalRegistryPath = path.join(__dirname, 'SourceData/Technical Registry.csv');
const pairingsPath = path.join(__dirname, 'SourceData/Pairing & Share Requests.csv');
const resultsPath = path.join(__dirname, 'results.csv');
const dataJsonPath = path.join(__dirname, 'data.json');

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i+1];

        if (char === '"' && inQuotes && nextChar === '"') {
            currentCell += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.length > 0 && currentRow.some(c => c)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    // Final cell/row
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    if (rows.length === 0) return [];

    const headers = rows[0];
    const results = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const entry = {};
        headers.forEach((h, index) => {
            if (h) entry[h] = row[index] || '';
        });
        results.push(entry);
    }
    return results;
}

// 1. Load Technical Registry
console.log('Parsing Technical Registry...');
const registry = parseCSV(technicalRegistryPath);

// 2. Load Results (for existing per-org pass/fail if still used, but we'll focus on pairwise)
console.log('Parsing Results...');
const globalResults = parseCSV(resultsPath);

// 3. Load Pairings
console.log('Parsing Pairings...');
const plannedPairings = parseCSV(pairingsPath);

const scenarios = [
    { id: 'API-01', name: 'Credential Discovery', category: 'Core' },
    { id: 'API-02', name: 'Authorization & SAD Lifecycle', category: 'Core' },
    { id: 'API-03', name: 'Hash-Based Signing (Single Hash)', category: 'Core' },
    { id: 'API-05', name: 'Deterministic Error Handling', category: 'Core' },
    { id: 'SC-01', name: 'Document Signing (Wallet-to-RSSP)', category: 'Advanced' },
    { id: 'SC-02', name: 'Multi-Provider Interoperability', category: 'Advanced' }
];

const companies = registry.map((row, index) => {
    const orgName = row['Canonical Organisation'] || row['Organisation Variants'] || 'Unknown';
    
    // Heuristic for roles - handle "Yes", "Yes / demo", etc.
    const isYes = (val) => val && val.toLowerCase().includes('yes');
    const roles = [];
    if (isYes(row['Wallet'])) roles.push('Wallet Provider');
    if (isYes(row['CSC Provider'])) roles.push('CSC Service Provider (QTSP / RSSP)');
    if (isYes(row['CSC Client'])) roles.push('CSC Client (non-wallet)');
    if (isYes(row['Issuer'])) roles.push('Issuer');
    if (isYes(row['RP / Verifier'])) roles.push('Relying Party / Verifier');
    if (isYes(row['Observer']) || (row['Participation Type'] || '').includes('Observer')) {
        roles.push('Observer / Witness (no active implementation)');
    }

    // Heuristic for implementations
    const implementations = (row['What They Are Bringing'] || '').split(/;|\n/).map(s => s.trim()).filter(s => s);

    // Heuristic for scenarios (based on roles)
    const mappedScenarios = [];
    if (roles.includes('CSC Service Provider (QTSP / RSSP)') || roles.includes('Wallet Provider') || roles.includes('CSC Client (non-wallet)')) {
        mappedScenarios.push('API-01', 'API-02', 'API-03', 'API-05');
    }
    if (roles.includes('Wallet Provider')) {
        mappedScenarios.push('SC-01', 'SC-02');
    } else if (roles.includes('CSC Service Provider (QTSP / RSSP)')) {
        mappedScenarios.push('SC-01');
    }

    return {
        id: `org_${index}`,
        organisation: orgName,
        contact: row['Primary Contacts'] || '',
        participants: (row['Participants Attending'] || '')
            .split(/\r?\n/)
            .map(p => p.replace(/\s*\(.*?\)\s*/g, '').trim())
            .filter(p => p),
        roles: roles,
        implementations: implementations,
        scenarios: [...new Set(mappedScenarios)],
        technical_details: {
            endpoints_available: row['Endpoints Available'] || 'No public endpoints confirmed',
            technical_details: row['URLs / Sandbox / Technical Details'] || '',
            auth_requirements: row['Auth / Access Requirements'] || '',
            trust_anchors: row['Trust / Certificates / Anchors'] || '',
            technical_constraints: row['Technical Constraints'] || ''
        }
    };
});

// Process Pairings into a map for easy lookup
const pairingMap = {};
plannedPairings.forEach(p => {
    const key = `${p['Participant A']}_${p['Participant B']}`;
    pairingMap[key] = {
        status: p['Recommendation Status'] || 'Recommended',
        notes: p['Rationale / Notes'] || ''
    };
});

const finalData = {
    scenarios,
    companies,
    pairings: pairingMap
};

fs.writeFileSync(dataJsonPath, JSON.stringify(finalData, null, 2));
console.log(`Processed ${companies.length} companies and ${Object.keys(pairingMap).length} pairings.`);
