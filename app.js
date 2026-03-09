document.addEventListener('DOMContentLoaded', () => {
    let appData = { scenarios: [], companies: [] };
    const grid = document.getElementById('mappingGrid');
    const searchInput = document.getElementById('companySearch');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Fetch the processed data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            appData = data;
            renderCompanies(data.companies);
        })
        .catch(err => {
            console.error('Error loading data:', err);
            grid.innerHTML = '<p class="error">Error loading data. Please check the network tab.</p>';
        });

    function renderCompanies(companies) {
        if (companies.length === 0) {
            grid.innerHTML = '<p class="no-results">No companies found matching your criteria.</p>';
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

        // Add event listeners to cards for extra details (optional modal)
        document.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', () => showDetails(card.dataset.id));
        });
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
                    ${company.implementations.length > 0 ? company.implementations.join(', ') : 'None specified'}
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

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = appData.companies.filter(c => 
            c.organisation.toLowerCase().includes(term) || 
            c.contact.toLowerCase().includes(term) ||
            c.participants.some(p => p.toLowerCase().includes(term))
        );
        renderCompanies(filtered);
    });

    // Filter functionality
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            if (filter === 'all') {
                renderCompanies(appData.companies);
            } else {
                const filtered = appData.companies.filter(c => {
                    const companyScenarios = appData.scenarios.filter(s => c.scenarios.includes(s.id));
                    return companyScenarios.some(s => s.category === filter);
                });
                renderCompanies(filtered);
            }
        });
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
