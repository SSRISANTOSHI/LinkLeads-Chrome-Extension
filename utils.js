// Utility functions
class LeadManager {
  static async getLeads() {
    return new Promise(resolve => {
      chrome.storage.local.get(['myLeads'], result => {
        resolve(result.myLeads || []);
      });
    });
  }

  static async saveLeads(leads) {
    return new Promise(resolve => {
      chrome.storage.local.set({ myLeads: leads }, resolve);
    });
  }

  static async getSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get(['settings'], result => {
        resolve(result.settings || {
          theme: 'dark',
          autoSaveBookmarks: false,
          checkLinksOnLoad: true
        });
      });
    });
  }

  static async saveSettings(settings) {
    return new Promise(resolve => {
      chrome.storage.local.set({ settings }, resolve);
    });
  }

  static getFavicon(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ccc"/></svg>';
    }
  }

  static formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  static async checkLinkStatus(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      return response.ok;
    } catch {
      return false;
    }
  }

  static exportLeads(leads, format = 'json') {
    const data = format === 'json' ? 
      JSON.stringify(leads, null, 2) :
      leads.map(lead => `${lead.title || lead.url}\t${lead.url}\t${lead.category}\t${lead.tags.join(',')}`).join('\n');
    
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkleads-export.${format === 'json' ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static generateSuggestions(currentUrl, savedLeads) {
    try {
      const currentDomain = new URL(currentUrl).hostname;
      return savedLeads
        .filter(lead => {
          const leadDomain = new URL(lead.url).hostname;
          return leadDomain === currentDomain || 
                 lead.tags.some(tag => currentUrl.toLowerCase().includes(tag));
        })
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  static findDuplicates(leads) {
    const seen = new Set();
    return leads.filter(lead => {
      if (seen.has(lead.url)) return true;
      seen.add(lead.url);
      return false;
    });
  }

  static shareToSocial(url, title, platform) {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
    };
    
    if (shareUrls[platform]) {
      chrome.tabs.create({ url: shareUrls[platform] });
    }
  }
}