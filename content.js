// Content script for page analysis
function getPageMetadata() {
  const title = document.title;
  const description = document.querySelector('meta[name="description"]')?.content || '';
  const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
  const readingTime = estimateReadingTime();
  
  return { title, description, keywords, readingTime };
}

function estimateReadingTime() {
  const text = document.body.innerText;
  const words = text.split(/\s+/).length;
  const wpm = 200; // average reading speed
  return Math.ceil(words / wpm);
}

function generateTags() {
  const text = document.body.innerText.toLowerCase();
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = text.split(/\s+/).filter(word => 
    word.length > 3 && !commonWords.includes(word)
  );
  
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageData') {
    sendResponse({
      ...getPageMetadata(),
      suggestedTags: generateTags()
    });
  }
});