let audioContext, mediaRecorder, stream, socket;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.command === "startRecording") {

    const apiKey = await new Promise((resolve) => {
        chrome.storage.local.get('deepGramApiKey', (result) => {
          resolve(result.deepGramApiKey);
        });
      });
      console.error('deepGramApiKey', apiKey);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
    if (tab && tab.url.includes("meet.google.com")) {
    // Start capturing the tab audio and microphone
    /* const tabStream = await new Promise((resolve, reject) => {
        chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
          if (chrome.runtime.lastError || !stream) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(stream);
          }
        });
      }); */

    const tabStream = await navigator.mediaDevices.getDisplayMedia({ 
      audio: true,
      video: false
    });  

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new AudioContext();
    const tabSource = audioContext.createMediaStreamSource(tabStream);
    const micSource = audioContext.createMediaStreamSource(micStream);

    // Merge tab and mic audio into a single stream
    const destination = audioContext.createMediaStreamDestination();
    tabSource.connect(destination);
    micSource.connect(destination);

    stream = destination.stream;
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    /* mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        // Process the audio chunk for transcription
        await sendForTranscription(event.data);
      }
    }; */

    socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=general-enhanced', ['token', apiKey])

    mediaRecorder.addEventListener('dataavailable', evt => {
        if(evt.data.size > 0 && socket.readyState == 1) socket.send(evt.data)
    })

    socket.onopen = () => { mediaRecorder.start(250) }

    socket.onmessage = msg => {
        const { transcript } = JSON.parse(msg.data).channel.alternatives[0]
        if(transcript) {
            console.error('recevint transcript', transcript);
            chrome.storage.local.get('transcript', data => {
                chrome.storage.local.set({ transcript: data.transcript += ' ' + transcript })

                // Throws error when popup is closed, so this swallows the errors.
                chrome.runtime.sendMessage({ message: 'transcriptavailable' }).catch(err => ({}))
            })
        }
    }
  }
  else
  {
    console.error('tab is not google meet');
  }
}

  if (message.command === "stopRecording") {
    socket.close()
    mediaRecorder.stop();
    stream.getTracks().forEach(track => track.stop());
    audioContext.close();
  }
});

