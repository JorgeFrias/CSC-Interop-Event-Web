const fs = require('fs');
const https = require('https');

const FORMSPREE_API_KEY = process.env.FORMSPREE_API_KEY;
const FORM_ID = 'xnjgovqy'; // Extract from the HTML form
const CSV_FILE = 'results.csv';

if (!FORMSPREE_API_KEY) {
    console.error('Error: FORMSPREE_API_KEY environment variable is missing.');
    process.exit(1);
}

// Fetch submissions from Formspree API
function fetchSubmissions() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'formspree.io',
            path: `/api/0/forms/${FORM_ID}/submissions`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FORMSPREE_API_KEY}`,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.submissions || []);
                    } catch (e) {
                        reject(new Error('Failed to parse Formspree response'));
                    }
                } else {
                    reject(new Error(`Formspree API error: ${res.statusCode} ${data}`));
                }
            });
        });

        req.on('error', error => reject(error));
        req.end();
    });
}

// Simple CSV parser
function parseCSV(content) {
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = parseLine(lines[0]);
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        rows.push(parseLine(line));
    }
    return { headers, rows };
}

function parseLine(line) {
    const row = [];
    let inQuotes = false;
    let current = '';
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    row.push(current.trim());
    return row;
}

// Simple CSV stringifier
function stringifyCSV(headers, rows) {
    const escapeField = (field) => {
        if (field === undefined || field === null) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headerLine = headers.map(escapeField).join(',');
    const rowLines = rows.map(row => row.map(escapeField).join(','));
    return [headerLine, ...rowLines].join('\n') + '\n';
}

async function run() {
    try {
        console.log('Fetching submissions from Formspree...');
        const submissions = await fetchSubmissions();
        
        // Sort ascending by time so newer submissions overwrite older ones
        submissions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
        let { headers, rows } = parseCSV(csvContent);

        let updatedCount = 0;

        for (const sub of submissions) {
            // Need the details from the submission
            const { member1, role1, member2, role2, status, details } = sub;
            
            if (!member1 || !member2 || !status) continue;
            
            // Determine provider (column) and consumer (row) based on roles
            let providerName = '';
            let consumerName = '';
            let consumerRole = 'Wallet'; // Default fallback

            const isProvider = (role) => (role && (role.toLowerCase().includes('provider') || role.toLowerCase().includes('rssp') || role.toLowerCase().includes('issuer')));

            if (isProvider(role1) && !isProvider(role2)) {
                providerName = member1;
                consumerName = member2;
                consumerRole = role2 || 'Wallet'; // Or Client/Observer depending on actual role
            } else if (isProvider(role2) && !isProvider(role1)) {
                providerName = member2;
                consumerName = member1;
                consumerRole = role1 || 'Wallet';
            } else {
                // If we can't determine cleanly by string, guess based on "member1 vs member2", but Formspree uses the form fields natively.
                // Assuming member1 is provider from the "Submit Test Result" phrasing if roles are missing.
                providerName = member2; // Most generic defaults
                consumerName = member1;
            }

            // Cleanup names to match CSV (optional mapping could go here if organizations use different names)
            providerName = providerName.trim();
            consumerName = consumerName.trim();

            // 1. Check if provider column exists. If not, add before "Notes" or "Role"
            let providerColIndex = headers.indexOf(providerName);
            if (providerColIndex === -1) {
                // Find where to insert it. Usually before 'Notes', or if no 'Notes', before 'Role'.
                let insertionIndex = headers.indexOf('Notes');
                if (insertionIndex === -1) insertionIndex = headers.indexOf('Role');
                if (insertionIndex === -1) insertionIndex = headers.length; // Append if Role not found

                headers.splice(insertionIndex, 0, providerName);
                providerColIndex = insertionIndex;
                
                // Add empty cells to all existing rows for this new column
                for (let r of rows) {
                    r.splice(insertionIndex, 0, '');
                }
            }

            // Ensure Notes column exists if user wants to store details eventually. The prompt said "Let's do not add a notes column"
            // Wait, I will NOT insert Notes column as user requested.
            
            // 2. Determine Consumer Row
            let orgIndex = headers.indexOf('Organization');
            let roleIndex = headers.indexOf('Role');
            
            let rowIndex = rows.findIndex(r => r[orgIndex] && r[orgIndex].replace(/"/g, '').trim().toLowerCase() === consumerName.toLowerCase());
            
            if (rowIndex === -1) {
                // Create new row
                const newRow = new Array(headers.length).fill('');
                newRow[orgIndex] = consumerName;
                if (roleIndex !== -1) newRow[roleIndex] = consumerRole;
                rows.push(newRow);
                rowIndex = rows.length - 1;
            }

            // 3. Update the exact cell
            rows[rowIndex][providerColIndex] = status;
            updatedCount++;
        }

        if (updatedCount > 0) {
            const newCsvStr = stringifyCSV(headers, rows);
            fs.writeFileSync(CSV_FILE, newCsvStr, 'utf8');
            console.log(`Successfully processed ${updatedCount} submissions and updated results.csv.`);
        } else {
            console.log('No new specific test results found to update.');
        }

    } catch (error) {
        console.error('Failed to run fetch_results script:', error.message);
        process.exit(1);
    }
}

run();
