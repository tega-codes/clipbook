let saveButton = null;
let selectionTimeout = null;
let currentUrl = window.location.href;

// Create save button
function createSaveButton() {
  const button = document.createElement('div');
  button.id = 'clip-save-button';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
    </svg>
    <span>Save to Clipboard</span>
  `;
  button.style.display = 'none';
  document.body.appendChild(button);
  return button;
}

// Get domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Position button near selection
function positionButton(x, y) {
  if (!saveButton) return;
  
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  const buttonWidth = 180;
  const buttonHeight = 40;
  const offset = 10;
  
  let left = x + scrollX + offset;
  let top = y + scrollY - buttonHeight - offset;
  
  // Adjust if button goes off screen
  if (left + buttonWidth > window.innerWidth + scrollX) {
    left = x + scrollX - buttonWidth - offset;
  }
  
  if (top < scrollY) {
    top = y + scrollY + offset;
  }
  
  saveButton.style.left = `${left}px`;
  saveButton.style.top = `${top}px`;
}

// Get favicon URL
function getFaviconUrl() {
  // Try to find favicon in the page
  let favicon = document.querySelector('link[rel="icon"]') || 
                document.querySelector('link[rel="shortcut icon"]') ||
                document.querySelector('link[rel="apple-touch-icon"]');
  
  if (favicon && favicon.href) {
    return favicon.href;
  }
  
  // Fallback to default favicon location
  const url = new URL(currentUrl);
  return `${url.protocol}//${url.host}/favicon.ico`;
}

// Save selection to storage
async function saveSelection(text) {
  try {
    const result = await chrome.storage.local.get(['clips']);
    const clips = result.clips || [];
    
    // Check if same text from same domain already exists
    const domain = getDomain(currentUrl);
    const existingIndex = clips.findIndex(
      clip => clip.text === text && clip.domain === domain
    );
    
    const newClip = {
      text: text,
      url: currentUrl,
      domain: domain,
      favicon: getFaviconUrl(),
      timestamp: Date.now()
    };
    
    // If exists, update timestamp, otherwise add new
    if (existingIndex !== -1) {
      clips[existingIndex] = newClip;
    } else {
      clips.unshift(newClip);
    }
    
    await chrome.storage.local.set({ clips: clips });
    
    // Show success feedback
    showSaveConfirmation();
    
    // Notify popup to refresh
    chrome.runtime.sendMessage({ action: 'clipSaved' });
  } catch (error) {
    console.error('Error saving clip:', error);
  }
}

// Show save confirmation
function showSaveConfirmation() {
  const confirmation = document.createElement('div');
  confirmation.id = 'clip-save-confirmation';
  confirmation.textContent = '✓ Saved to Clipboard';
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.style.opacity = '0';
    setTimeout(() => confirmation.remove(), 300);
  }, 2000);
}

// Handle text selection
function handleSelection() {
  clearTimeout(selectionTimeout);
  
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      positionButton(rect.right, rect.top);
      saveButton.style.display = 'flex';
      
      // Store current selection
      saveButton.dataset.selectedText = text;
    } else {
      if (saveButton) {
        saveButton.style.display = 'none';
      }
    }
  }, 200);
}

// Initialize
function init() {
  saveButton = createSaveButton();
  
  // Handle selection
  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
      handleSelection();
    }
  });
  
  // Handle save button click
  saveButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const text = saveButton.dataset.selectedText;
    if (text) {
      await saveSelection(text);
      saveButton.style.display = 'none';
      window.getSelection().removeAllRanges();
    }
  });
  
  // Hide button on scroll or click outside
  document.addEventListener('scroll', () => {
    if (saveButton) {
      saveButton.style.display = 'none';
    }
  });
  
  document.addEventListener('mousedown', (e) => {
    if (saveButton && !saveButton.contains(e.target)) {
      const selection = window.getSelection();
      if (selection.toString().trim().length === 0) {
        saveButton.style.display = 'none';
      }
    }
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}