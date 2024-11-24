chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message === 'start') {
      const streamId = await new Promise((resolve) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
                resolve(streamId);
            });
        });
        console.error('BACKGROUND StreamId', streamId);
        chrome.tabs.create({ url: 'https://deepgram.com' }, async (newTab) => {
          // await chrome.scripting.executeScript({
          //   target: { tabId: newTab.id },
          //   files: ["content-script.js"]
          // });

          async function sendMessageAfterTimeout() {
            try {
              await new Promise(resolve => setTimeout(resolve, 5000));
              await chrome.tabs.sendMessage(newTab.id, { message: 'start', streamId });
              console.error('Message sent to content script in new tab.');
            } catch (error) {
              console.error('Error sending message to content script:', error);
            }
          }
        
          await sendMessageAfterTimeout();
        });
    }
  });

