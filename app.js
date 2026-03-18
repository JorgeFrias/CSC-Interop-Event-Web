document.addEventListener('DOMContentLoaded', () => {
    const APP_VERSION = '1.3.0';
    console.log(`CSC Event Wallet v${APP_VERSION} initialized`);

    // Theme logic
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) themeIcon.textContent = 'dark_mode';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            if (themeIcon) themeIcon.textContent = isLight ? 'dark_mode' : 'light_mode';
        });
    }

    // Set dynamic Formspree redirects with cache busting
    const forms = document.querySelectorAll('form[action*="formspree.io"]');
    forms.forEach(form => {
        const nextInput = form.querySelector('input[name="_next"]');
        if (nextInput) {
            const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, "");
            nextInput.value = `${baseUrl}?success&t=${Date.now()}`;
        }
    });
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
    const viewSuggestionsBtn = document.getElementById('viewSuggestions');
    const viewSubmitResultsBtn = document.getElementById('viewSubmitResults');
    const playbookView = document.getElementById('playbookView');
    const suggestionsView = document.getElementById('suggestionsView');
    const submitResultsView = document.getElementById('submitResultsView');
    const successView = document.getElementById('successView');
    const playbookContent = document.querySelector('.playbook-content');
    const filterGroup = document.querySelector('.filter-group');
    const controls = document.querySelector('.controls');

    // Initial fetch
    fetchData();


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

    function setActiveNav(activeId) {
        const navButtons = [
            viewGridBtn, viewTableBtn, viewPlaybookBtn, 
            viewSuggestionsBtn, viewSubmitResultsBtn
        ];
        
        navButtons.forEach(btn => {
            if (btn) {
                if (btn.id === activeId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    function checkRoute() {
        const path = window.location.pathname.toLowerCase().replace(/\/$/, "");
        const searchParams = new URLSearchParams(window.location.search);
        
        if (searchParams.has('success')) {
            currentView = 'success';
            setActiveNav(null); // None active for success view
        } else if (path.endsWith('/coverage-test') || (searchParams.has('view') && searchParams.get('view') === 'table')) {
            currentView = 'table';
            setActiveNav('viewTable');
        } else if (path.endsWith('/directory') || (searchParams.has('view') && searchParams.get('view') === 'grid')) {
            currentView = 'grid';
            setActiveNav('viewGrid');
        } else if (path.endsWith('/suggestions') || (searchParams.has('view') && searchParams.get('view') === 'suggestions')) {
            currentView = 'suggestions';
            setActiveNav('viewSuggestions');
        } else if (path.endsWith('/submit-results') || (searchParams.has('view') && searchParams.get('view') === 'submit')) {
            currentView = 'submitResults';
            setActiveNav('viewSubmitResults');
        } else {
            // Default to playbook for / or any other path
            currentView = 'playbook';
            setActiveNav('viewPlaybook');
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
            const line = lines[i].trim();
            if (!line) continue;
            
            // More robust CSV parsing that handles empty fields
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
            
            if (row.length < headers.length) continue;
            
            const orgData = {};
            const orgName = row[0].replace(/"/g, '').trim();
            
            headers.forEach((header, index) => {
                if (index > 0 && index < headers.length - 1) { // Scenario or partner columns
                    orgData[header] = row[index];
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
        } else if (currentView === 'suggestions') {
            controls.style.display = 'none';
            renderSuggestions();
        } else if (currentView === 'submitResults') {
            controls.style.display = 'none';
            renderSubmitResults();
        } else if (currentView === 'success') {
            controls.style.display = 'none';
            renderSuccess();
        }
    }

    function hideAllViews() {
        grid.style.display = 'none';
        summaryView.style.display = 'none';
        playbookView.style.display = 'none';
        suggestionsView.style.display = 'none';
        submitResultsView.style.display = 'none';
        if (successView) successView.style.display = 'none';
    }

    function renderSuccess() {
        hideAllViews();
        successView.style.display = 'block';
    }

    function renderSuggestions() {
        hideAllViews();
        suggestionsView.style.display = 'block';
    }

    function renderSubmitResults() {
        hideAllViews();
        submitResultsView.style.display = 'block';

        const member1Select = document.getElementById('member1');
        const member2Select = document.getElementById('member2');

        if (member1Select.options.length <= 1) { // Only populate if empty (first option is the placeholder)
            const sortedCompanies = [...appData.companies].sort((a, b) => a.organisation.localeCompare(b.organisation));
            
            sortedCompanies.forEach(company => {
                const opt1 = document.createElement('option');
                opt1.value = company.organisation;
                opt1.textContent = company.organisation;
                member1Select.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = company.organisation;
                opt2.textContent = company.organisation;
                member2Select.appendChild(opt2);
            });
        }
    }

    function renderPlaybook() {
        hideAllViews();
        playbookView.style.display = 'block';

        if (!renderPlaybook.loaded) {
            const cacheBuster = `?t=${Date.now()}`;
            fetch(`playbook.md${cacheBuster}`)
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
                                 (c.contact || '').toLowerCase().includes(term) ||
                                 c.participants.some(p => p.toLowerCase().includes(term));
            
            if (!matchesSearch) return false;
            if (currentFilter === 'all') return true;
            
            const companyScenarios = appData.scenarios.filter(s => c.scenarios.includes(s.id));
            return companyScenarios.some(s => s.category === currentFilter);
        });
    }

    function renderCompaniesGrid(companies) {
        hideAllViews();
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
        hideAllViews();
        summaryView.style.display = 'block';

        if (companies.length === 0) {
            summaryTable.innerHTML = '<tr><td style="text-align: center; padding: 3rem; color: var(--text-dim);">No results found.</td></tr>';
            return;
        }

        // Extract Wallets and RSSPs from the filtered list, excluding withdrawn participants from the Matrix
        const isNotWithdrawn = c => c.technical_details && c.technical_details.endpoints_available !== 'Withdrawn';
        const wallets = companies.filter(c => (c.roles.includes('Wallet Provider') || c.roles.includes('CSC Client (non-wallet)') || c.roles.includes('CSC Client (wallet provider)')) && isNotWithdrawn(c));
        const rssps = companies.filter(c => c.roles.includes('CSC Service Provider (QTSP / RSSP)') && isNotWithdrawn(c));

        if (wallets.length === 0 || rssps.length === 0) {
            summaryTable.innerHTML = '<tr><td style="text-align: center; padding: 3rem; color: var(--text-dim);">Not enough participants to form a matrix (need both Wallets and RSSPs in the current view).</td></tr>';
            return;
        }

        const headerHtml = `
            <thead>
                <tr>
                    <th class="participant-cell sticky-col" style="vertical-align: bottom;">Consumer \\ Provider</th>
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
                            const pairingKey = `${wallet.organisation}_${rssp.organisation}`;
                            const pairing = appData.pairings[pairingKey];
                            
                            // Case-insensitive result lookup
                            const normalizedWalletName = wallet.organisation.toLowerCase();
                            const normalizedRsspName = rssp.organisation.toLowerCase();
                            
                            let result = null;
                            const resOrgKey = Object.keys(resultsData).find(k => k.toLowerCase() === normalizedWalletName);
                            if (resOrgKey) {
                                const resRsspKey = Object.keys(resultsData[resOrgKey]).find(k => k.toLowerCase() === normalizedRsspName);
                                if (resRsspKey) {
                                    result = resultsData[resOrgKey][resRsspKey];
                                }
                            }
                            
                            let status = 'untested';
                            let icon = '';
                            let title = `${wallet.organisation} vs ${rssp.organisation}`;

                            if (result) {
                                status = result.toLowerCase();
                                const iconMap = { 'pass': '✅', 'partial': '🔶', 'issue': '❌' };
                                icon = iconMap[status] || '❓';
                                title += `: ${result}`;
                            } else if (pairing) {
                                status = 'planned';
                                icon = '📋';
                                title += `: Planned (${pairing.status})`;
                                if (pairing.notes) title += ` - ${pairing.notes}`;
                            }
                            
                            return `<td class="status-cell">
                                <span class="status-icon ${status}" title="${title}">
                                    ${icon}
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
        
        const tech = company.technical_details || {};
        
        body.innerHTML = `
            <h2 class="org-name" style="font-size: 2rem;">${company.organisation}</h2>
            <div class="role-tags">
                ${company.roles.map(role => `<span class="role-tag" style="font-size: 0.9rem;">${role}</span>`).join('')}
            </div>
            
            <div class="modal-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                <div class="modal-left">
                    <h3 style="margin-bottom: 1rem;">Registered Technical Team</h3>
                    <ul style="list-style: none; margin-bottom: 2rem;">
                        ${company.participants.map(p => `<li style="padding: 0.5rem 0; border-bottom: 1px solid var(--glass-border);">${p}</li>`).join('')}
                    </ul>

                    <h3 style="margin-bottom: 1rem;">Implementation Roles</h3>
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 1rem; margin-bottom: 2rem;">
                        <strong>Active Components:</strong><br>
                        ${Array.isArray(company.implementations) ? company.implementations.join(', ') : 'No specific details provided'}
                    </div>

                    <h3 style="margin-bottom: 1rem;">Covered CSC Scenarios</h3>
                    <div class="scenario-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem;">
                        ${appData.scenarios.filter(s => company.scenarios.includes(s.id)).map(s => `
                            <div class="scenario-item card" style="background: rgba(255,255,255,0.03); padding: 0.5rem;">
                                <strong style="color: ${s.category === 'Core' ? 'var(--core-color)' : 'var(--advanced-color)'}">${s.id}</strong><br>
                                <small style="font-size: 0.7rem;">${s.name}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="modal-right">
                    <h3 style="margin-bottom: 1rem; color: var(--core-color);">Technical Integration Details</h3>
                    
                    <div class="tech-detail-item" style="margin-bottom: 1.5rem;">
                        <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Endpoints Status</span>
                        <p style="margin-top: 0.25rem;">${tech.endpoints_available || 'TBD'}</p>
                    </div>

                    <div class="tech-detail-item" style="margin-bottom: 1.5rem;">
                        <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Connection Details / Sandboxes</span>
                        <pre style="margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;">${tech.technical_details || 'Not provided'}</pre>
                    </div>

                    <div class="tech-detail-item" style="margin-bottom: 1.5rem;">
                        <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Auth / Access Requirements</span>
                        <p style="margin-top: 0.25rem; font-size: 0.9rem;">${tech.auth_requirements || 'Standard OAuth2'}</p>
                    </div>

                    <div class="tech-detail-item" style="margin-bottom: 1.5rem;">
                        <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Trust & Certificates</span>
                        <pre style="margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;">${tech.trust_anchors || 'Standard QTSP chain'}</pre>
                    </div>

                    ${tech.technical_constraints ? `
                        <div class="tech-detail-item">
                            <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Technical Constraints</span>
                            <p style="margin-top: 0.25rem; font-size: 0.9rem; color: #ff9f43;">${tech.technical_constraints}</p>
                        </div>
                    ` : ''}
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
        setActiveNav('viewGrid');
        currentView = 'grid';
        history.pushState(null, '', 'directory');
        updateDisplay();
    });

    viewTableBtn.addEventListener('click', () => {
        setActiveNav('viewTable');
        currentView = 'table';
        history.pushState(null, '', 'coverage-test');
        updateDisplay();
    });

    viewPlaybookBtn.addEventListener('click', () => {
        setActiveNav('viewPlaybook');
        currentView = 'playbook';
        history.pushState(null, '', 'playbook');
        updateDisplay();
    });

    viewSuggestionsBtn.addEventListener('click', () => {
        setActiveNav('viewSuggestions');
        currentView = 'suggestions';
        history.pushState(null, '', 'suggestions');
        updateDisplay();
    });

    viewSubmitResultsBtn.addEventListener('click', () => {
        setActiveNav('viewSubmitResults');
        currentView = 'submitResults';
        history.pushState(null, '', 'submit-results');
        updateDisplay();
    });

    const returnToPlaybookBtn = document.getElementById('returnToPlaybook');
    if (returnToPlaybookBtn) {
        returnToPlaybookBtn.addEventListener('click', () => {
            viewPlaybookBtn.click();
        });
    }

    toggleExpandBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        localStorage.setItem('tableExpanded', isExpanded);
        updateExpansionUI();
    });

    // Share Page (QR Code) logic
    const sharePageBtn = document.getElementById('sharePage');
    if (sharePageBtn) {
        sharePageBtn.addEventListener('click', () => {
            const modal = document.getElementById('modal');
            const body = document.getElementById('modalBody');
            
            body.innerHTML = `
                <div class="qr-container">
                    <h2 class="glow-text" style="font-size: 1.8rem; margin-bottom: 0.5rem;">Share this page</h2>
                    <p style="color: var(--text-dim); margin-bottom: 2rem;">Scan this code to open the current view on another device.</p>
                    <div id="qrcode" class="qrcode-wrapper glass"></div>
                    <div class="copy-link-wrapper" style="margin-top: 2rem; width: 100%;">
                        <div class="search-box" style="display: flex; gap: 0.5rem;">
                            <input type="text" id="shareUrl" value="${window.location.href}" readonly style="flex: 1;">
                            <button id="copyUrlBtn" class="nav-btn active" style="padding: 0 1.5rem;">Copy</button>
                        </div>
                    </div>
                </div>
            `;

            modal.style.display = 'block';
            document.body.classList.add('no-scroll');

            // Generate QR Code
            new QRCode(document.getElementById("qrcode"), {
                text: window.location.href,
                width: 256,
                height: 256,
                colorDark : "#6366f1",
                colorLight : "transparent",
                correctLevel : QRCode.CorrectLevel.H
            });
        });
    }

    // File Upload State Logic
    const fileInput = document.getElementById('fileUpload');
    const fileInputCustom = document.querySelector('.file-input-custom span');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                fileInputCustom.textContent = fileName;
                fileInputCustom.parentElement.style.borderColor = 'var(--accent-color)';
                fileInputCustom.parentElement.style.background = 'rgba(110, 89, 255, 0.1)'; // Hardcoded fallback for reliability
            } else {
                fileInputCustom.textContent = 'Choose a file...';
                fileInputCustom.parentElement.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                fileInputCustom.parentElement.style.background = 'rgba(255, 255, 255, 0.05)';
            }
        });
    }

    // Share Url Copy functionality (Event Delegation for modal button)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'copyUrlBtn') {
            const urlInput = document.getElementById('shareUrl');
            urlInput.select();
            document.execCommand('copy');
            
            const copyBtn = e.target;
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = 'var(--core-color)';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }
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
