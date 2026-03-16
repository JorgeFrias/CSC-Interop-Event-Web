document.addEventListener('DOMContentLoaded', () => {
    let resultsData = {}; // From CSV: { "Org Name": { "API-01": "Pass", ... } }
    let appData = { scenarios: [], companies: [] };
    let currentFilter = 'all';
    let currentView = 'playbook';
    let isExpanded = false;

    const mainContainer = document.querySelector('main.container');
    const grid = document.getElementById('mappingGrid');
    const summaryView = document.getElementById('summaryView');
    const summaryTable = document.getElementById('summaryTable');
    const toggleExpandBtn = document.getElementById('toggleExpand');
    const searchInput = document.getElementById('companySearch');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const viewGridBtn = document.getElementById('viewGrid');
    const viewTableBtn = document.getElementById('viewTable');
    const viewPlaybookBtn = document.getElementById('viewPlaybook');
    const playbookView = document.getElementById('playbookView');
    const playbookContent = document.querySelector('.playbook-content');
    const filterGroup = document.querySelector('.filter-group');
    const controls = document.querySelector('.controls');

    // Initial fetch
    fetchData();

    // Auto-refresh every 60 seconds
    setInterval(fetchData, 60000);

    function fetchData() {
        const cacheBuster = `?t=${Date.now()}`;
        Promise.all([
            fetch(`data.json${cacheBuster}`).then(r => r.json()),
            fetch(`results.csv${cacheBuster}`).then(r => r.text())
        ])
        .then(([jsonData, csvText]) => {
            appData = jsonData;
            resultsData = parseResultsCSV(csvText);
            
            // Only handle routing on the very first load to avoid disrupting the view
            if (!fetchData.initialized) {
                checkRoute();
                loadExpansionState();
                fetchData.initialized = true;
            }
            
            updateDisplay();
            console.log('Data refreshed:', new Date().toLocaleTimeString());
        })
        .catch(err => {
            console.error('Error refreshing data:', err);
        });
    }

    function checkRoute() {
        const path = window.location.pathname.toLowerCase().replace(/\/$/, "");
        const searchParams = new URLSearchParams(window.location.search);
        
        if (path.endsWith('/coverage-test') || searchParams.has('view') && searchParams.get('view') === 'table') {
            currentView = 'table';
            viewTableBtn.classList.add('active');
            viewGridBtn.classList.remove('active');
            viewPlaybookBtn.classList.remove('active');
        } else if (path.endsWith('/directory') || searchParams.has('view') && searchParams.get('view') === 'grid') {
            currentView = 'grid';
            viewGridBtn.classList.add('active');
            viewTableBtn.classList.remove('active');
            viewPlaybookBtn.classList.remove('active');
        } else {
            // Default to playbook for / or any other path
            currentView = 'playbook';
            viewPlaybookBtn.classList.add('active');
            viewGridBtn.classList.remove('active');
            viewTableBtn.classList.remove('active');
        }
    }

    function loadExpansionState() {
        const saved = localStorage.getItem('tableExpanded');
        if (saved === 'true') {
            isExpanded = true;
            updateExpansionUI();
        }
    }

    function updateExpansionUI() {
        const expandIcon = document.getElementById('expandIcon');
        const btnText = toggleExpandBtn.querySelector('span:not(.material-symbols-outlined)');

        if (isExpanded) {
            mainContainer.classList.add('expanded');
            expandIcon.textContent = 'close_fullscreen';
            btnText.textContent = 'Collapse';
        } else {
            mainContainer.classList.remove('expanded');
            expandIcon.textContent = 'open_in_full';
            btnText.textContent = 'Full Width';
        }
    }

    function parseResultsCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = {};

        for (let i = 1; i < lines.length; i++) {
            // Basic CSV parsing (handles quotes)
            const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!row) continue;
            
            const orgData = {};
            const orgName = row[0].replace(/"/g, '').trim();
            
            headers.forEach((header, index) => {
                if (index > 0 && index < headers.length - 1) { // Scenario columns
                    orgData[header] = row[index].trim();
                }
            });
            data[orgName] = orgData;
        }
        return data;
    }

    function updateDisplay() {
        const filtered = filterData(appData.companies);
        if (currentView === 'grid') {
            controls.style.display = 'flex';
            filterGroup.style.display = 'flex';
            renderCompaniesGrid(filtered);
        } else if (currentView === 'table') {
            controls.style.display = 'flex';
            filterGroup.style.display = 'flex';
            renderSummaryTable(filtered);
        } else if (currentView === 'playbook') {
            controls.style.display = 'none';
            renderPlaybook();
        }
    }

    function renderPlaybook() {
        grid.style.display = 'none';
        summaryView.style.display = 'none';
        playbookView.style.display = 'block';

        if (!renderPlaybook.loaded) {
            fetch('playbook.md')
                .then(r => r.text())
                .then(text => {
                    playbookContent.innerHTML = marked.parse(text);
                    renderPlaybook.loaded = true;
                })
                .catch(err => {
                    console.error('Error loading playbook:', err);
                    playbookContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-dim);">Error loading playbook content.</p>';
                });
        }
    }

    function filterData(companies) {
        const term = searchInput.value.toLowerCase();
        return companies.filter(c => {
            const matchesSearch = c.organisation.toLowerCase().includes(term) || 
                                 c.contact.toLowerCase().includes(term) ||
                                 c.participants.some(p => p.toLowerCase().includes(term));
            
            if (!matchesSearch) return false;
            if (currentFilter === 'all') return true;
            
            const companyScenarios = appData.scenarios.filter(s => c.scenarios.includes(s.id));
            return companyScenarios.some(s => s.category === currentFilter);
        });
    }

    function renderCompaniesGrid(companies) {
        grid.style.display = 'grid';
        summaryView.style.display = 'none';
        playbookView.style.display = 'none';

        if (companies.length === 0) {
            grid.innerHTML = '<p class="no-results" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-dim);">No participants found matching your criteria.</p>';
            return;
        }

        grid.innerHTML = companies.map(company => {
            const companyScenarios = appData.scenarios.filter(s => company.scenarios.includes(s.id));
            
            return `
                <div class="company-card card glass" data-id="${company.id}">
                    <div class="org-name">${company.organisation}</div>
                    <div class="role-tags">
                        ${company.roles.map(role => `<span class="role-tag">${role}</span>`).join('')}
                    </div>
                    <div class="participant-count">
                        <strong>Participants:</strong> ${company.participants.length} 
                        <br><small>${company.contact}</small>
                    </div>
                    <div class="scenario-list">
                        <div style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 0.5rem; font-weight: 600;">COVERED SCENARIOS:</div>
                        ${companyScenarios.map(s => `
                            <span class="scenario-tag ${s.category.toLowerCase()}" title="${s.name}">
                                ${s.id}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', () => showDetails(card.dataset.id));
        });
    }

    function renderSummaryTable(companies) {
        grid.style.display = 'none';
        summaryView.style.display = 'block';
        playbookView.style.display = 'none';

        if (companies.length === 0) {
            summaryTable.innerHTML = '<tr><td style="text-align: center; padding: 3rem; color: var(--text-dim);">No results found.</td></tr>';
            return;
        }

        // Extract Wallets and RSSPs from the filtered list
        const wallets = companies.filter(c => c.roles.includes('Wallet Provider'));
        const rssps = companies.filter(c => c.roles.includes('CSC Service Provider (QTSP / RSSP)'));

        if (wallets.length === 0 || rssps.length === 0) {
            summaryTable.innerHTML = '<tr><td style="text-align: center; padding: 3rem; color: var(--text-dim);">Not enough participants to form a matrix (need both Wallets and RSSPs in the current view).</td></tr>';
            return;
        }

        const headerHtml = `
            <thead>
                <tr>
                    <th class="participant-cell sticky-col" style="vertical-align: bottom;">Wallet \\ RSSP</th>
                    ${rssps.map(r => `<th class="status-cell rssp-header" title="${r.organisation}"><div class="vertical-text">${r.organisation}</div></th>`).join('')}
                </tr>
            </thead>
        `;

        const bodyHtml = `
            <tbody>
                ${wallets.map(wallet => `
                    <tr>
                        <td class="participant-cell sticky-col">${wallet.organisation}</td>
                        ${rssps.map(rssp => {
                            const status = getMockStatus(wallet.id, rssp.id);
                            const iconMap = { 'Pass': '✅', 'Partial': '🔶', 'Issue': '❌', 'Untested': '' };
                            const classMap = { 'Pass': 'pass', 'Partial': 'partial', 'Issue': 'issue', 'Untested': 'untested' };
                            
                            return `<td class="status-cell">
                                <span class="status-icon ${classMap[status]}" title="${wallet.organisation} (Wallet) vs ${rssp.organisation} (RSSP): ${status}">
                                    ${iconMap[status]}
                                </span>
                            </td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        `;

        summaryTable.innerHTML = headerHtml + bodyHtml;
    }

    function getMockStatus(id1, id2) {
        // Hash the ids together for consistent mocking based on pair
        let hash = 0;
        const str = id1 + "_" + id2;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        hash = Math.abs(hash);
        
        const rand = hash % 100;
        if (rand < 50) return 'Pass';
        if (rand < 70) return 'Untested';
        if (rand < 85) return 'Partial';
        return 'Issue';
    }

    function showDetails(id) {
        const company = appData.companies.find(c => c.id === id);
        if (!company) return;

        const modal = document.getElementById('modal');
        const body = document.getElementById('modalBody');
        
        body.innerHTML = `
            <h2 class="org-name" style="font-size: 2rem;">${company.organisation}</h2>
            <div class="role-tags">
                ${company.roles.map(role => `<span class="role-tag" style="font-size: 0.9rem;">${role}</span>`).join('')}
            </div>
            
            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">Registered Technical Team</h3>
                <ul style="list-style: none; margin-bottom: 2rem;">
                    ${company.participants.map(p => `<li style="padding: 0.5rem 0; border-bottom: 1px solid var(--glass-border);">${p}</li>`).join('')}
                </ul>
            </div>

            <div>
                <h3 style="margin-bottom: 1rem;">Implementation Details</h3>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 1rem;">
                    <strong>Active Implementations:</strong><br>
                    ${Array.isArray(company.implementations) ? company.implementations.join(', ') : Object.values(company.implementations).join(', ')}
                </div>
            </div>

            <div style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem;">Covered CSC Scenarios</h3>
                <div class="scenario-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    ${appData.scenarios.filter(s => company.scenarios.includes(s.id)).map(s => `
                        <div class="scenario-item card" style="background: rgba(255,255,255,0.03); padding: 0.8rem;">
                            <strong style="color: ${s.category === 'Core' ? 'var(--core-color)' : 'var(--advanced-color)'}">${s.id}</strong><br>
                            <small>${s.name}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.style.display = 'block';
        document.body.classList.add('no-scroll');
    }

    // Event Listeners
    searchInput.addEventListener('input', () => updateDisplay());

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            updateDisplay();
        });
    });

    viewGridBtn.addEventListener('click', () => {
        viewGridBtn.classList.add('active');
        viewTableBtn.classList.remove('active');
        viewPlaybookBtn.classList.remove('active');
        currentView = 'grid';
        history.pushState(null, '', 'directory');
        updateDisplay();
    });

    viewTableBtn.addEventListener('click', () => {
        viewTableBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        viewPlaybookBtn.classList.remove('active');
        currentView = 'table';
        history.pushState(null, '', 'coverage-test');
        updateDisplay();
    });

    viewPlaybookBtn.addEventListener('click', () => {
        viewPlaybookBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        viewTableBtn.classList.remove('active');
        currentView = 'playbook';
        history.pushState(null, '', 'playbook');
        updateDisplay();
    });

    toggleExpandBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        localStorage.setItem('tableExpanded', isExpanded);
        updateExpansionUI();
    });

    // Close modal
    document.querySelector('.close-btn').onclick = () => {
        document.getElementById('modal').style.display = 'none';
        document.body.classList.remove('no-scroll');
    };

    window.onclick = (event) => {
        const modal = document.getElementById('modal');
        if (event.target == modal) {
            modal.style.display = 'none';
            document.body.classList.remove('no-scroll');
        }
    };
});
