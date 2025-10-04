let myLeads = [];
let filteredLeads = [];
let selectedLeads = new Set();
let settings = {};

// DOM elements
const elements = {
  input: document.getElementById('input-el'),
  inputBtn: document.getElementById('input-btn'),
  tabBtn: document.getElementById('tab-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  searchEl: document.getElementById('search-el'),
  categoryFilter: document.getElementById('category-filter'),
  bulkSelect: document.getElementById('bulk-select'),
  bulkDelete: document.getElementById('bulk-delete'),
  exportBtn: document.getElementById('export-btn'),
  checkLinks: document.getElementById('check-links'),
  themeToggle: document.getElementById('theme-toggle'),
  settingsBtn: document.getElementById('settings-btn'),
  ulEl: document.getElementById('ul-el'),
  totalCount: document.getElementById('total-count'),
  brokenLinks: document.getElementById('broken-links'),
  modal: document.getElementById('modal')
};

// Initialize
init();

async function init() {
  myLeads = await LeadManager.getLeads();
  settings = await LeadManager.getSettings();
  
  // Migrate old localStorage data
  const oldLeads = JSON.parse(localStorage.getItem('myLeads') || '[]');
  if (oldLeads.length && !myLeads.length) {
    myLeads = oldLeads.map(url => ({
      url: typeof url === 'string' ? url : url.url,
      title: typeof url === 'object' ? url.title : url,
      timestamp: Date.now(),
      visits: 0,
      category: 'general',
      tags: [],
      notes: ''
    }));
    await LeadManager.saveLeads(myLeads);
    localStorage.removeItem('myLeads');
  }
  
  applyTheme(settings.theme);
  filteredLeads = [...myLeads];
  render();
  updateStats();
  
  if (settings.checkLinksOnLoad) {
    checkBrokenLinks();
  }
}

// Event listeners
elements.inputBtn.addEventListener('click', addLead);
elements.tabBtn.addEventListener('click', saveCurrentTab);
elements.deleteBtn.addEventListener('dblclick', deleteAllLeads);
elements.searchEl.addEventListener('input', handleSearch);
elements.categoryFilter.addEventListener('change', handleFilter);
elements.bulkSelect.addEventListener('click', toggleSelectAll);
elements.bulkDelete.addEventListener('click', deleteSelected);
elements.exportBtn.addEventListener('click', exportLeads);
elements.checkLinks.addEventListener('click', checkBrokenLinks);
elements.themeToggle.addEventListener('click', toggleTheme);
elements.settingsBtn.addEventListener('click', showSettings);

// Core functions
async function addLead() {
  const url = elements.input.value.trim();
  if (!url) return;
  
  if (!isValidUrl(url)) {
    alert('Please enter a valid URL');
    return;
  }
  
  if (myLeads.some(lead => lead.url === url)) {
    alert('URL already exists!');
    return;
  }
  
  const lead = {
    url,
    title: url,
    timestamp: Date.now(),
    visits: 0,
    category: categorizeUrl(url),
    tags: [],
    notes: ''
  };
  
  myLeads.unshift(lead);
  await LeadManager.saveLeads(myLeads);
  elements.input.value = '';
  applyFilters();
  render();
  updateStats();
}

async function saveCurrentTab() {
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const tab = tabs[0];
    
    if (myLeads.some(lead => lead.url === tab.url)) {
      alert('URL already exists!');
      return;
    }
    
    // Get page metadata
    let pageData = { title: tab.title, suggestedTags: [] };
    try {
      pageData = await new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, {action: 'getPageData'}, response => {
          resolve(response || pageData);
        });
      });
    } catch (e) {}
    
    const lead = {
      url: tab.url,
      title: pageData.title || tab.title,
      timestamp: Date.now(),
      visits: 0,
      category: categorizeUrl(tab.url),
      tags: pageData.suggestedTags || [],
      notes: '',
      readingTime: pageData.readingTime || 0
    };
    
    myLeads.unshift(lead);
    await LeadManager.saveLeads(myLeads);
    applyFilters();
    render();
    updateStats();
  });
}

function render() {
  if (!filteredLeads.length) {
    elements.ulEl.innerHTML = '<li style="text-align: center; color: var(--text-secondary); padding: 20px;">No leads found</li>';
    return;
  }
  
  elements.ulEl.innerHTML = filteredLeads.map((lead, index) => `
    <li class="lead-item ${selectedLeads.has(lead.url) ? 'selected' : ''}" data-url="${lead.url}">
      <div class="lead-header">
        <input type="checkbox" class="checkbox" ${selectedLeads.has(lead.url) ? 'checked' : ''}>
        <img class="favicon" src="${LeadManager.getFavicon(lead.url)}" onerror="this.style.display='none'">
        <span class="lead-title">${lead.title || lead.url}</span>
        <span class="visit-count">${lead.visits} visits</span>
      </div>
      
      <a href="${lead.url}" target="_blank" class="lead-url">${lead.url}</a>
      
      ${lead.tags.length ? `<div class="tags">${lead.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
      
      <div class="lead-meta">
        <span class="category-tag">${lead.category}</span>
        <span>${LeadManager.formatDate(lead.timestamp)}</span>
        ${lead.readingTime ? `<span class="reading-time">${lead.readingTime} min read</span>` : ''}
      </div>
      
      <div class="lead-actions">
        <button onclick="editLead('${lead.url}')">Edit</button>
        <button onclick="shareLead('${lead.url}')">Share</button>
        <button onclick="deleteLead('${lead.url}')" style="background: var(--danger)">Delete</button>
      </div>
      
      ${lead.notes ? `<div class="note" style="margin-top: 6px; font-size: 12px; color: var(--text-secondary);">${lead.notes}</div>` : ''}
    </li>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.checkbox').forEach(cb => {
    cb.addEventListener('change', handleCheckboxChange);
  });
  
  document.querySelectorAll('.lead-url').forEach(link => {
    link.addEventListener('click', handleLinkClick);
  });
}

function handleSearch() {
  applyFilters();
}

function handleFilter() {
  applyFilters();
}

function applyFilters() {
  const searchTerm = elements.searchEl.value.toLowerCase();
  const category = elements.categoryFilter.value;
  
  filteredLeads = myLeads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.title.toLowerCase().includes(searchTerm) ||
      lead.url.toLowerCase().includes(searchTerm) ||
      lead.tags.some(tag => tag.toLowerCase().includes(searchTerm));
    
    const matchesCategory = category === 'all' || lead.category === category;
    
    return matchesSearch && matchesCategory;
  });
  
  render();
  updateStats();
}

function updateStats() {
  elements.totalCount.textContent = `${filteredLeads.length} leads`;
  const brokenCount = myLeads.filter(lead => lead.broken).length;
  elements.brokenLinks.textContent = `${brokenCount} broken`;
}

// Utility functions
function isValidUrl(string) {
  try {
    new URL(string.startsWith('http') ? string : 'https://' + string);
    return true;
  } catch {
    return false;
  }
}

function categorizeUrl(url) {
  const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase();
  if (domain.includes('github') || domain.includes('stackoverflow') || domain.includes('docs')) return 'documentation';
  if (domain.includes('twitter') || domain.includes('facebook') || domain.includes('linkedin')) return 'social';
  if (domain.includes('amazon') || domain.includes('shop') || domain.includes('store')) return 'shopping';
  if (domain.includes('news') || domain.includes('cnn') || domain.includes('bbc')) return 'news';
  if (domain.includes('youtube') || domain.includes('netflix') || domain.includes('video')) return 'media';
  return 'general';
}

// Event handlers
function handleCheckboxChange(e) {
  const url = e.target.closest('.lead-item').dataset.url;
  if (e.target.checked) {
    selectedLeads.add(url);
  } else {
    selectedLeads.delete(url);
  }
  e.target.closest('.lead-item').classList.toggle('selected', e.target.checked);
}

function handleLinkClick(e) {
  const url = e.target.href;
  const lead = myLeads.find(l => l.url === url);
  if (lead) {
    lead.visits++;
    LeadManager.saveLeads(myLeads);
  }
}

function toggleSelectAll() {
  const allSelected = selectedLeads.size === filteredLeads.length;
  selectedLeads.clear();
  
  if (!allSelected) {
    filteredLeads.forEach(lead => selectedLeads.add(lead.url));
  }
  
  render();
}

async function deleteSelected() {
  if (!selectedLeads.size) return;
  
  if (confirm(`Delete ${selectedLeads.size} selected leads?`)) {
    myLeads = myLeads.filter(lead => !selectedLeads.has(lead.url));
    selectedLeads.clear();
    await LeadManager.saveLeads(myLeads);
    applyFilters();
    render();
    updateStats();
  }
}

async function deleteAllLeads() {
  myLeads = [];
  selectedLeads.clear();
  await LeadManager.saveLeads(myLeads);
  applyFilters();
  render();
  updateStats();
}

function exportLeads() {
  LeadManager.exportLeads(myLeads);
}

async function checkBrokenLinks() {
  elements.checkLinks.textContent = 'Checking...';
  
  for (const lead of myLeads) {
    lead.broken = !(await LeadManager.checkLinkStatus(lead.url));
  }
  
  await LeadManager.saveLeads(myLeads);
  render();
  updateStats();
  elements.checkLinks.textContent = 'CHECK LINKS';
}

function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(settings.theme);
  LeadManager.saveSettings(settings);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  elements.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Global functions for onclick handlers
window.editLead = function(url) {
  const lead = myLeads.find(l => l.url === url);
  showEditModal(lead);
};

window.shareLead = function(url) {
  const lead = myLeads.find(l => l.url === url);
  showShareModal(lead);
};

window.deleteLead = async function(url) {
  if (confirm('Delete this lead?')) {
    myLeads = myLeads.filter(l => l.url !== url);
    await LeadManager.saveLeads(myLeads);
    applyFilters();
    render();
    updateStats();
  }
};

function showEditModal(lead) {
  elements.modal.style.display = 'block';
  elements.modal.querySelector('#modal-body').innerHTML = `
    <h3>Edit Lead</h3>
    <input type="text" id="edit-title" value="${lead.title}" placeholder="Title">
    <input type="text" id="edit-tags" value="${lead.tags.join(', ')}" placeholder="Tags (comma separated)">
    <textarea id="edit-notes" placeholder="Notes">${lead.notes}</textarea>
    <div style="margin-top: 10px;">
      <button onclick="saveEdit('${lead.url}')">Save</button>
      <button onclick="closeModal()">Cancel</button>
    </div>
  `;
}

function showShareModal(lead) {
  elements.modal.style.display = 'block';
  elements.modal.querySelector('#modal-body').innerHTML = `
    <h3>Share Lead</h3>
    <p>${lead.title}</p>
    <div style="display: flex; gap: 10px; margin-top: 15px;">
      <button onclick="LeadManager.shareToSocial('${lead.url}', '${lead.title}', 'twitter')">Twitter</button>
      <button onclick="LeadManager.shareToSocial('${lead.url}', '${lead.title}', 'facebook')">Facebook</button>
      <button onclick="LeadManager.shareToSocial('${lead.url}', '${lead.title}', 'linkedin')">LinkedIn</button>
      <button onclick="LeadManager.shareToSocial('${lead.url}', '${lead.title}', 'email')">Email</button>
    </div>
    <button onclick="closeModal()" style="margin-top: 15px;">Close</button>
  `;
}

function showSettings() {
  elements.modal.style.display = 'block';
  elements.modal.querySelector('#modal-body').innerHTML = `
    <h3>Settings</h3>
    <label><input type="checkbox" ${settings.autoSaveBookmarks ? 'checked' : ''}> Auto-save bookmarks</label><br>
    <label><input type="checkbox" ${settings.checkLinksOnLoad ? 'checked' : ''}> Check links on load</label><br>
    <div style="margin-top: 15px;">
      <button onclick="saveSettings()">Save</button>
      <button onclick="closeModal()">Cancel</button>
    </div>
  `;
}

window.saveEdit = async function(url) {
  const lead = myLeads.find(l => l.url === url);
  lead.title = document.getElementById('edit-title').value;
  lead.tags = document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(t => t);
  lead.notes = document.getElementById('edit-notes').value;
  
  await LeadManager.saveLeads(myLeads);
  closeModal();
  render();
};

window.saveSettings = async function() {
  const checkboxes = elements.modal.querySelectorAll('input[type="checkbox"]');
  settings.autoSaveBookmarks = checkboxes[0].checked;
  settings.checkLinksOnLoad = checkboxes[1].checked;
  
  await LeadManager.saveSettings(settings);
  closeModal();
};

window.closeModal = function() {
  elements.modal.style.display = 'none';
};

// Close modal on outside click
elements.modal.addEventListener('click', (e) => {
  if (e.target === elements.modal) closeModal();
});
