chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message === 'start') {
      const streamId = await new Promise((resolve) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
                resolve(streamId);
            });
        });
        console.error('BACKGROUND StreamId', streamId);
        chrome.tabs.sendMessage(message.tabId, { message: 'start', streamId })
        return true;
    }
  });