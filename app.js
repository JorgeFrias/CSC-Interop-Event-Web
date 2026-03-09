document.addEventListener('DOMContentLoaded', () => {
    let appData = { scenarios: [], companies: [] };
    let currentFilter = 'all';
    let currentView = 'grid'; // 'grid' or 'table'

    const grid = document.getElementById('mappingGrid');
    const summaryView = document.getElementById('summaryView');
    const summaryTable = document.getElementById('summaryTable');
    const searchInput = document.getElementById('companySearch');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const viewGridBtn = document.getElementById('viewGrid');
    const viewTableBtn = document.getElementById('viewTable');

    // Fetch the processed data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            appData = data;
            updateDisplay();
        })
        .catch(err => {
            console.error('Error loading data:', err);
            grid.innerHTML = '<p class="error">Error loading data. Please check the network tab.</p>';
        });

    function updateDisplay() {
        const filtered = filterData(appData.companies);
        if (currentView === 'grid') {
            renderCompaniesGrid(filtered);
        } else {
            renderSummaryTable(filtered);
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

        if (companies.length === 0) {
            summaryTable.innerHTML = '<tr><td style="text-align: center; padding: 3rem; color: var(--text-dim);">No results found.</td></tr>';
            return;
        }

        // Use a fixed set of scenarios for the columns to keep it clean, 
        // prioritizing Core then Advanced
        const scenarios = appData.scenarios;
        
        const headerHtml = `
            <thead>
                <tr>
                    <th class="participant-cell">Participant</th>
                    ${scenarios.map(s => `<th class="status-cell" title="${s.name}">${s.id}</th>`).join('')}
                    <th>Role</th>
                </tr>
            </thead>
        `;

        const bodyHtml = `
            <tbody>
                ${companies.map(company => `
                    <tr>
                        <td class="participant-cell">${company.organisation}</td>
                        ${scenarios.map(s => {
                            const isCovered = company.scenarios.includes(s.id);
                            return `<td class="status-cell">
                                <span class="status-icon ${isCovered ? 'pass' : 'untested'}" title="${isCovered ? 'Pass' : 'Not tested'}">
                                    ${isCovered ? '✅' : '⚪'}
                                </span>
                            </td>`;
                        }).join('')}
                        <td class="role-cell">
                            ${company.roles.map(r => {
                                if (r.includes('Wallet')) return 'Wallet';
                                if (r.includes('Service Provider')) return 'RSSP/QTSP';
                                if (r.includes('Client')) return 'Client';
                                if (r.includes('Observer')) return 'Observer';
                                return r;
                            }).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        summaryTable.innerHTML = headerHtml + bodyHtml;
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
        currentView = 'grid';
        updateDisplay();
    });

    viewTableBtn.addEventListener('click', () => {
        viewTableBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        currentView = 'table';
        updateDisplay();
    });

    // Close modal
    document.querySelector('.close-btn').onclick = () => {
        document.getElementById('modal').style.display = 'none';
    };

    window.onclick = (event) => {
        const modal = document.getElementById('modal');
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
});
