const fs = require('fs');
const path = require('path');

const rowsPath = path.join(__dirname, 'responses/res_21_rows.txt');
const dataPath = path.join(__dirname, 'data.json');

const rawData = fs.readFileSync(rowsPath, 'utf8');
// The file starts with URL:, then a newline, then the JSON
const jsonStartIndex = rawData.indexOf('{');
if (jsonStartIndex === -1) {
    console.error('Could not find JSON start');
    process.exit(1);
}

const jsonString = rawData.substring(jsonStartIndex);
const parsed = JSON.parse(jsonString);

const submissions = parsed.content;

const scenarios = [
    { id: 'API-01', name: 'Credential Discovery', category: 'Core' },
    { id: 'API-02', name: 'Authorization & SAD Lifecycle', category: 'Core' },
    { id: 'API-03', name: 'Hash-Based Signing (Single Hash)', category: 'Core' },
    { id: 'API-05', name: 'Deterministic Error Handling', category: 'Core' },
    { id: 'SC-01', name: 'Document Signing (Wallet-to-RSSP)', category: 'Advanced' },
    { id: 'SC-02', name: 'Multi-Provider Interoperability', category: 'Advanced' }
];

const processedData = submissions.map(sub => {
    const answers = sub.answers;
    const org = answers['7'] ? answers['7'].answer : 'Unknown';
    const roles = answers['116'] ? answers['116'].answer : [];
    const implementations = answers['118'] ? answers['118'].answer : [];
    const participants = answers['113'] ? answers['113'].answer : '';
    const name = answers['4'] ? answers['4'].prettyFormat : 'Unknown';

    // Map scenarios based on roles and implementations
    // This is a heuristic based on the user request
    const mappedScenarios = [];

    const hasRSSP = roles.includes('CSC Service Provider (QTSP / RSSP)');
    const hasWallet = roles.includes('Wallet Provider');
    const hasClient = roles.includes('CSC Client (non-wallet)');
    
    if (hasRSSP || hasWallet || hasClient) {
        mappedScenarios.push('API-01', 'API-02', 'API-03', 'API-05');
    }

    if (hasWallet && hasRSSP) {
        mappedScenarios.push('SC-01', 'SC-02');
    } else if (hasWallet || hasRSSP) {
        mappedScenarios.push('SC-01'); // Participation in one side
    }

    return {
        id: sub.id,
        organisation: org,
        contact: name,
        participants: participants.split('\n').filter(p => p.trim() !== ''),
        roles: roles,
        implementations: implementations,
        scenarios: mappedScenarios
    };
});

fs.writeFileSync(dataPath, JSON.stringify({ scenarios, companies: processedData }, null, 2));
console.log(`Processed ${processedData.length} submissions.`);
