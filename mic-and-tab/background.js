chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message === 'start') {
      const streamId = await new Promise((resolve) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
                resolve(streamId);
            });
        });
        //chrome.tabs.create({ url: 'https://deepgram.com' });
        console.error('BACKGROUND StreamId', streamId);
        //const createdTab = await getCurrentTab();
        //console.error('current tab', JSON.stringify(createdTab));
        chrome.tabs.sendMessage(message.tabId, { message: 'start', streamId })
        return true;
    }
  });

  async function getCurrentTab() {
    const queryOptions = { active: true, lastFocusedWindow: true }
    const [tab] = await chrome.tabs.query(queryOptions)
    return tab
}