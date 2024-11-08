
chrome.runtime.onMessage.addListener(async ({ message }) => {
    let socket, recorder;
    let isRecording = false; 
    
    if (message === "start" && !isRecording) {
        console.error('start');
        isRecording = true;  // Set recording state to true
        chrome.storage.local.set({ transcript: "" });

        const apiKey = await getApiKey();

        if (!apiKey) {
            alert("You must provide a Deepgram API Key in the options page.");
            isRecording = false;
            return;
        }
        else
        {
            console.error('api key', apiKey);
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true
        });

        console.error('screenStream');

        if (screenStream.getAudioTracks().length === 0) {
            alert("You must share your tab with audio. Refresh the page.");
            isRecording = false;
            return;
        }

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        console.error('micStream');

        const audioContext = new AudioContext();
        const mixedStream = mix(audioContext, [screenStream, micStream]);

        console.error('mixedStream');
        recorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

        console.error('recorder');

        socket = new WebSocket("wss://api.deepgram.com/v1/listen?model=general-enhanced", ["token", apiKey]);

        recorder.addEventListener("dataavailable", (evt) => {
            if (evt.data.size > 0 && socket.readyState === 1) socket.send(evt.data);
        });

        socket.onopen = () => { recorder.start(250); };

        socket.onmessage = (msg) => {
            const { transcript } = JSON.parse(msg.data).channel.alternatives[0];
            if (transcript) {
                chrome.storage.local.get("transcript", (data) => {
                    chrome.storage.local.set({ transcript: (data.transcript || "") + " " + transcript });

                    // Notify popup of new transcript availability
                    chrome.runtime.sendMessage({ message: "transcriptavailable" }).catch(() => { });
                });
            }
        };

    } else if (message === "stop" && isRecording) {
        console.error('stop');
        if (socket) socket.close();
        if (recorder) recorder.stop();
        isRecording = false;  // Reset recording state
        alert("Transcription ended");
    }
});

// Helper function to mix streams
function mix(audioContext, streams) {
    const dest = audioContext.createMediaStreamDestination();
    streams.forEach((stream) => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(dest);
    });
    return dest.stream;
}

async function getApiKey() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get("key", (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result.key);
        });
    });
}