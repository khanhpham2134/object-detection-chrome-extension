chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed");
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "openDetectionTab") {
        chrome.tabs.create({ url: "detection.html" });
    }
});