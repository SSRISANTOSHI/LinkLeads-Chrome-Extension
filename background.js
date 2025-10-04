// Background script for enhanced features
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveLinkLead",
    title: "Save to LinkLeads",
    contexts: ["link", "page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveLinkLead") {
    const url = info.linkUrl || info.pageUrl;
    chrome.storage.local.get(['myLeads'], (result) => {
      const leads = result.myLeads || [];
      if (!leads.some(lead => lead.url === url)) {
        leads.push({
          url,
          title: tab.title,
          timestamp: Date.now(),
          visits: 0,
          category: categorizeUrl(url),
          tags: []
        });
        chrome.storage.local.set({ myLeads: leads });
      }
    });
  }
});

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  if (bookmark.url) {
    chrome.storage.local.get(['myLeads', 'autoSaveBookmarks'], (result) => {
      if (result.autoSaveBookmarks) {
        const leads = result.myLeads || [];
        if (!leads.some(lead => lead.url === bookmark.url)) {
          leads.push({
            url: bookmark.url,
            title: bookmark.title,
            timestamp: Date.now(),
            visits: 0,
            category: categorizeUrl(bookmark.url),
            tags: []
          });
          chrome.storage.local.set({ myLeads: leads });
        }
      }
    });
  }
});

function categorizeUrl(url) {
  const domain = new URL(url).hostname.toLowerCase();
  if (domain.includes('github') || domain.includes('stackoverflow') || domain.includes('docs')) return 'documentation';
  if (domain.includes('twitter') || domain.includes('facebook') || domain.includes('linkedin')) return 'social';
  if (domain.includes('amazon') || domain.includes('shop') || domain.includes('store')) return 'shopping';
  if (domain.includes('news') || domain.includes('cnn') || domain.includes('bbc')) return 'news';
  if (domain.includes('youtube') || domain.includes('netflix') || domain.includes('video')) return 'media';
  return 'general';
}