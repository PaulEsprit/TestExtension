let socket, recorder;
let isRecording = false; 
let data = [];

chrome.runtime.onMessage.addListener(({ message, streamId }) => {      
    if (message === "start" && !isRecording) {
       startRecording(streamId);
    }
});

chrome.runtime.onMessage.addListener(async ({ message }) => {  
    if (message === "stop" && isRecording) {
        console.error('stop');
        if (socket) socket.close();
        if (recorder) recorder.stop();
        isRecording = false;  // Reset recording state
        chrome.storage.local.remove(['transcript']);
        alert("Transcription ended");
    }
 });


 async function startRecording(streamId) {
        console.error('start');
        console.error('streamId', streamId);
        isRecording = true;  // Set recording state to true
        chrome.storage.local.set({ transcript: "" });

        const { apiKey, language } = await getApiSettings();

        if (!apiKey) {
            alert("You must provide a Deepgram API Key in the options page.");
            isRecording = false;
            return;
        }
        else
        {
            console.error('api key', apiKey);
            console.error('language', language);
        }

        config = {
            "video": {
                "mandatory": {
                    "chromeMediaSourceId": streamId,
                    "chromeMediaSource": "tab"
                }
            },
            "audio": {
                "mandatory": {
                    "chromeMediaSourceId": streamId,
                    "chromeMediaSource": "tab"
                }
            }
        }


     navigator.mediaDevices.getUserMedia(config).then(async (tabStream) => {

        /* const screenStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true
        }); */

        console.error('screenStream');

        if (tabStream.getAudioTracks().length === 0) {
            alert("You must share your tab with audio. Refresh the page.");
            isRecording = false;
            return;
        }

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        console.error('micStream');

        const audioContext = new AudioContext();
        const mixedStream = mix(audioContext, [tabStream, micStream]);

        console.error('mixedStream');
        recorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

        console.error('recorder');

        //const socketUrl =`wss://api.deepgram.com/v1/listen?model=nova-2&language=en&sample_rate=48000&diarize=true&encoding=opus`
        const socketUrl =`wss://api.deepgram.com/v1/listen?model=nova-2&language=${language}`
        
        socket = new WebSocket(socketUrl, ["token", apiKey]);

        console.error('socket');

        recorder.addEventListener("dataavailable", (evt) => {
            if (evt.data.size > 0 && socket.readyState === 1) {
                socket.send(evt.data);
                data.push(evt.data);
            };
        });

        recorder.onstop = async () => {
            console.error('recorder.onstop');
            const blob = new Blob(data, { type: 'audio/webm' });
      
            //window.open(URL.createObjectURL(blob), '_blank');
            downloadFileAudio(blob);
            const transcript = await sendAudioToDeepgram(blob, apiKey, language);//await getTranscriptData();
            const speakerTranscript = createSpeakersTranscript(transcript);
            downloadFileTranscription(JSON.stringify(speakerTranscript));

            recorder = undefined;
            data = [];
          };

        socket.onopen = () => { 
            recorder.start(250);
            console.error('socket opened');
        };

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
    })
 }

 function downloadFileAudio(blob){
    var url = URL.createObjectURL(blob);
      
    const downloadLink = document.createElement('a');

    // Set the anchor's attributes
    downloadLink.href = url;
    downloadLink.download = 'demo.webm'; // Specify the desired filename

    // Programmatically trigger a click event on the anchor to initiate the download
    downloadLink.click();
}

function downloadFileTranscription(transcript) {
    const encodedTranscript = encodeURIComponent(transcript);
    const url = `data:text/plain;charset=utf-8,${encodedTranscript}`;

    const downloadLink = document.createElement('a');

    // Set the anchor's attributes
    downloadLink.href = url;
    downloadLink.download = `transcript_${Date.now()}.txt`; // Specify the desired filename

    // Programmatically trigger a click event on the anchor to initiate the download
    downloadLink.click();
    
}


// Helper function to mix streams
function mix(audioContext, streams) {
    const dest = audioContext.createMediaStreamDestination();
    streams.forEach((stream) => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(dest);
    });
    return dest.stream;
}

async function getApiSettings() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['key', 'language'], (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve({ apiKey: result.key, language: result.language });
        });
    });
}

async function getTranscriptData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('transcript', (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result.transcript);
        });
    });
}


async function sendAudioToDeepgram(audioBlob, apiKey, language) {
    const url = `https://api.deepgram.com/v1/listen?model=nova-2-general&language=${language}&diarize=true`;
    
    // Create a FormData object if needed, or send the blob directly in the body
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'audio/webm'  // or adjust to match the Blob format
        },
        body: audioBlob
      });
  
      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.statusText}`);
      }
  
      const data = await response.json();
  
      // Example: Access the transcription text
      //const transcript = data.results.channels[0].alternatives[0].transcript;
      console.error(JSON.stringify(data))
      return data;
       
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error);
    }
  }


    function createSpeakersTranscript(data) {
        const words = data.results.channels[0].alternatives[0].words;
    
        const speakerTranscript = {
            transcript: data.results.channels[0].alternatives[0].transcript,
            speakers: []
        };
    
        const speakers = ["Speaker1", "Speaker2"];
        let currentSpeakerIndex = 0; // Tracks the current speaker (0 or 1)
        let currentSentence = '';
        let currentStart = 0;
        let currentConfidence = words[0]?.speaker_confidence; // Start with the first word's confidence
    
        words.forEach((word, index) => {
            
            if (word.speaker_confidence !== currentConfidence || index === words.length - 1) {
             
                // If confidence changes or at the last word, save the current sentence
                if (currentSentence) {
                    speakerTranscript.speakers.push({
                        sentence: currentSentence.trim(),
                        start: currentStart,
                        end: word.start, // End of the last word in the sentence
                        speaker: speakers[currentSpeakerIndex]
                    });
                }
                // Switch speaker
                currentSpeakerIndex = 1 - currentSpeakerIndex; // Toggle between 0 and 1
                currentConfidence = word.speaker_confidence;
                currentSentence = ''; // Reset sentence
                currentStart = word.start; // Set new start time
            }
            
            // Build the current sentence
            currentSentence += word.word + ' ';
            
        });
    
        return speakerTranscript;
    }
