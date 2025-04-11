document.addEventListener('DOMContentLoaded', () => {
    const keywordInput = document.getElementById('objectKeyword');
    const suggestedObjectsSelect = document.getElementById('suggestedObjects');
    const startButton = document.getElementById('start');
    
    // Add event listener for suggested objects dropdown
    suggestedObjectsSelect.addEventListener('change', () => {
        if (suggestedObjectsSelect.value) {
            keywordInput.value = suggestedObjectsSelect.value;
        }
    });
    
    // Start detection when button is clicked
    startButton.addEventListener('click', () => {
        const keyword = keywordInput.value.trim().toLowerCase();
        if (keyword) {
            chrome.storage.local.set({ objectKeyword: keyword }, () => {
                chrome.runtime.sendMessage({ action: 'openDetectionTab' });
                window.close(); // Close the popup after starting
            });
        } else {
            // Show error if no keyword is entered
            keywordInput.style.borderColor = 'red';
            keywordInput.placeholder = 'Please enter an object keyword';
            setTimeout(() => {
                keywordInput.style.borderColor = '';
                keywordInput.placeholder = 'e.g., car, person, cat';
            }, 2000);
        }
    });
    
    // Allow pressing Enter to start detection
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startButton.click();
        }
    });
});