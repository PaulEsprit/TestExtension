let socketMic, socketTab, recorder, recorderMic, recorderTab;
let isRecording = false;
let data = [];
let dataMic = [];
let dataTab = [];
let recordKey;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.message === "start" && !isRecording) {
    await startRecording(message.streamId);
  }
});

chrome.runtime.onMessage.addListener(async ({ message }) => {
  if (message === "stop" && isRecording) {
    console.error("stop");
    if (socketMic) socketMic.close();
    if (socketTab) socketTab.close();    
    if (recorderMic) {
      recorderMic.stop();
      recorderMic = undefined;
      dataMic = [];
    }
    if (recorderTab) {
      recorderTab.stop();
      recorderTab = undefined;
      dataTab = [];
    }
    if (recorder) recorder.stop();
    isRecording = false; // Reset recording state
    chrome.storage.local.remove(["transcript"]);
    alert("Transcription ended");
  }
});

async function startRecording(streamId) {
  console.error("start");
  console.error("streamId", streamId);
  isRecording = true; // Set recording state to true
  chrome.storage.local.set({ transcript: "" });

  const { apiKey, language } = await getApiSettings();

  if (!apiKey) {
    alert("You must provide a Deepgram API Key in the options page.");
    isRecording = false;
    return;
  } else {
    console.error("api key", apiKey);
    console.error("language", language);
  }

  // const screenStream = await navigator.mediaDevices.getUserMedia({
  //     audio: {
  //       mandatory: {
  //         chromeMediaSource: "tab",
  //         chromeMediaSourceId: streamId,
  //       },
  //     },
  //     video: {
  //       mandatory: {
  //         chromeMediaSource: "tab",
  //         chromeMediaSourceId: streamId,
  //       },
  //     },
  //   });

  const tabStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });

  console.error("screenStream");

  if (tabStream.getAudioTracks().length === 0) {
    alert("You must share your tab with audio. Refresh the page.");
    isRecording = false;
    return;
  }

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  console.error("micStream");

//   const clonedMicStream = micStream.clone();
//   const clonedTabStream = tabStream.clone();
   const audioContext = new AudioContext();
   const mixedStream = mix(audioContext, [tabStream, micStream]);

   const audioContextTab = new AudioContext();
   const screenStream = mix(audioContextTab, [tabStream]);

  console.error("mixedStream");
  recorderTab = new MediaRecorder(screenStream, { mimeType: "audio/webm" });
  recorderMic = new MediaRecorder(micStream, { mimeType: "audio/webm" });  
  recorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

  console.error("recorder");

  const socketUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${language}&diarize=true&smart_format=true`;

  socketTab = new WebSocket(socketUrl, ["token", apiKey]);
  socketMic = new WebSocket(socketUrl, ["token", apiKey]);

  console.error("socket");

  recorderMic.addEventListener("dataavailable", (evt) => {
    if (evt.data.size > 0 && socketMic.readyState === 1) {
      socketMic.send(evt.data);
      dataMic.push(evt.data);
    }
  });
  recorderTab.addEventListener("dataavailable", (evt) => {
    if (evt.data.size > 0 && socketTab.readyState === 1) {
      socketTab.send(evt.data);
      dataTab.push(evt.data);
    }
  });
  recorder.addEventListener("dataavailable", (evt) => {
    if (evt.data.size > 0) {
      data.push(evt.data);
    }
  });

  recorder.onstop = async () => {
    console.error("recorder.onstop");
    const blob = new Blob(data, { type: "audio/webm" });

    //window.open(URL.createObjectURL(blob), '_blank');
    const fileName = downloadFileAudio(blob);
    //const transcript = await sendAudioToDeepgram(blob, apiKey, language);//await getTranscriptData();

    chrome.runtime.sendMessage(
      {
        message: "updateRecordBlob",
        payload: {
          key: recordKey,
          audio: fileName,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending message to background:",
            chrome.runtime.lastError
          );
        } else {
          console.log("Response from background:", response);
        }
      }
    );

    recorder = undefined;
    data = [];
    recordKey = undefined;
  };

  socketTab.onopen = () => {
    recorderTab.start(250);
    recorder.start(250);
    console.error("socketTab opened");
  };

  socketMic.onopen = () => {
    recorderMic.start(250);
    console.error("socketMic opened");
  };

  socketTab.onmessage = async (msg) => {
    console.error("socketTab.onmessage", JSON.stringify(JSON.parse(msg.data)));
    const { transcript } = JSON.parse(msg.data).channel.alternatives[0];
    const { words } = JSON.parse(msg.data).channel.alternatives[0];
    words.forEach((word) => {
      word.speakerName = `Speaker-${word.speaker}`;
    });
    if (transcript) {
      chrome.storage.local.get("transcript", (data) => {
        const currentTranscript = (data.transcript || "") + " " + transcript;
        chrome.storage.local.set({ transcript: currentTranscript });
        // Notify popup of new transcript availability
        chrome.runtime
          .sendMessage({ message: "transcriptavailable" })
          .catch(() => {});
      });

      if (!recordKey) {
        sendCreateRecord(transcript, words);
      } else {
        updateRecord(transcript, words);
      }
    }
  };

  socketMic.onmessage = async (msg) => {
    console.error("socketMic.onmessage", JSON.stringify(JSON.parse(msg.data)));
    const { transcript } = JSON.parse(msg.data).channel.alternatives[0];
    const { words } = JSON.parse(msg.data).channel.alternatives[0];
    words.forEach((word) => {
      word.speakerName = "Me";
    });
    if (transcript) {
      chrome.storage.local.get("transcript", (data) => {
        const currentTranscript = (data.transcript || "") + " " + transcript;
        chrome.storage.local.set({ transcript: currentTranscript });
        // Notify popup of new transcript availability
        chrome.runtime
          .sendMessage({ message: "transcriptavailable" })
          .catch(() => {});
      });

      if (!recordKey) {
        sendCreateRecord(transcript, words);
      } else {
        updateRecord(transcript, words);
      }
    }
  };
}

function sendCreateRecord(transcript, words) {
  recordKey = new Date().toISOString();
  var sessionName = `Session-${Date.now()}`;
  chrome.runtime.sendMessage(
    {
      message: "createRecord",
      payload: {
        key: recordKey,
        title: sessionName,
        transcript: transcript,
        speakers: words,
      },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending message to background:",
          chrome.runtime.lastError
        );
      } else {
        console.log("Response from background:", response);
      }
    }
  );
}

function updateRecord(transcript, words) {
  chrome.runtime.sendMessage(
    {
      message: "updateRecord",
      payload: {
        key: recordKey,
        transcript: transcript,
        speakers: words,
      },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending message to background:",
          chrome.runtime.lastError
        );
      } else {
        console.log("Response from background:", response);
      }
    }
  );
}

function downloadFileAudio(blob) {
  var url = URL.createObjectURL(blob);

  const downloadLink = document.createElement("a");

  // Set the anchor's attributes
  downloadLink.href = url;
  const fileName = `recording_${Date.now()}.webm`;
  downloadLink.download = fileName; // Specify the desired filename

  // Programmatically trigger a click event on the anchor to initiate the download
  downloadLink.click();

  return fileName;
}

function downloadFileTranscription(transcript) {
  const encodedTranscript = encodeURIComponent(transcript);
  const url = `data:text/plain;charset=utf-8,${encodedTranscript}`;

  const downloadLink = document.createElement("a");

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
    chrome.storage.local.get(["key", "language"], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve({ apiKey: result.key, language: result.language });
    });
  });
}

async function getTranscriptData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("transcript", (result) => {
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
  formData.append("audio", audioBlob, "recording.webm");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/webm", // or adjust to match the Blob format
      },
      body: audioBlob,
    });

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Example: Access the transcription text
    //const transcript = data.results.channels[0].alternatives[0].transcript;
    console.error(JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error sending audio to Deepgram:", error);
  }
}

function createSpeakersTranscript(data) {
  const words = data.results.channels[0].alternatives[0].words;

  const speakerTranscript = {
    transcript: data.results.channels[0].alternatives[0].transcript,
    speakers: [],
  };

  const speakers = ["Speaker1", "Speaker2"];
  let currentSpeakerIndex = 0; // Tracks the current speaker (0 or 1)
  let currentSentence = "";
  let currentStart = 0;
  let currentConfidence = words[0]?.speaker_confidence; // Start with the first word's confidence

  words.forEach((word, index) => {
    if (
      word.speaker_confidence !== currentConfidence ||
      index === words.length - 1
    ) {
      // If confidence changes or at the last word, save the current sentence
      if (currentSentence) {
        speakerTranscript.speakers.push({
          sentence: currentSentence.trim(),
          start: currentStart,
          end: word.start, // End of the last word in the sentence
          speaker: speakers[currentSpeakerIndex],
        });
      }
      // Switch speaker
      currentSpeakerIndex = 1 - currentSpeakerIndex; // Toggle between 0 and 1
      currentConfidence = word.speaker_confidence;
      currentSentence = ""; // Reset sentence
      currentStart = word.start; // Set new start time
    }

    // Build the current sentence
    currentSentence += word.word + " ";
  });

  return speakerTranscript;
}
