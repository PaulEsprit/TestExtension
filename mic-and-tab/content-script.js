let socketMic, socketTab, recorder, recorderMic, recorderTab;
let isRecording = false;
let data = [];
let dataMic = [];
let dataTab = [];
let recordKey;


window.addEventListener("beforeunload", (event) => {
  if (isRecording) {
    event.preventDefault();
    event.returnValue = ""; // Chrome ignores this value but still triggers the confirmation dialog
  }
});


chrome.runtime.onMessage.addListener(async (message) => {
  if (message.message === "start" && !isRecording) {
    await startRecording(message.streamId);
  }
});

chrome.runtime.onMessage.addListener(async ({ message }) => {
  if (message === "stop" && isRecording) {
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
    chrome.storage.local.set({ recording: isRecording });
    chrome.storage.local.remove(["transcript"]);
  }
});

async function startRecording() {
  isRecording = true; // Set recording state to true
  chrome.storage.local.set({ recording: isRecording });
  chrome.storage.local.set({ transcript: "" });

  const { apiKey, language } = await getApiSettings();

  if (!apiKey) {
    alert("You must provide a Deepgram API Key in the options page.");
    isRecording = false;
    return;
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

  if (tabStream.getAudioTracks().length === 0) {
    alert("You must share your tab with audio. Refresh the page.");
    isRecording = false;
    return;
  }

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const mixedStream = mix(audioContext, [tabStream, micStream]);

  const audioContextTab = new AudioContext();
  const screenStream = mix(audioContextTab, [tabStream]);

  recorderTab = new MediaRecorder(screenStream, { mimeType: "audio/webm" });
  recorderMic = new MediaRecorder(micStream, { mimeType: "audio/webm" });
  recorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

  const socketUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${language}&diarize=true&smart_format=true`;

  socketTab = new WebSocket(socketUrl, ["token", apiKey]);
  socketMic = new WebSocket(socketUrl, ["token", apiKey]);

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
    const blob = new Blob(data, { type: "audio/webm" });

    const fileName = downloadFileAudio(blob);

    chrome.runtime.sendMessage(
      {
        message: "updateRecordBlob",
        payload: {
          key: recordKey,
          audio: fileName,
        },
      },
      (response) => {
      }
    );

    recorder = undefined;
    data = [];
    recordKey = undefined;
  };

  socketTab.onopen = () => {
    recorderTab.start(250);
    recorder.start(250);
  };

  socketMic.onopen = () => {
    recorderMic.start(250);
  };

  socketTab.onmessage = async (msg) => {
    const { transcript } = JSON.parse(msg.data).channel.alternatives[0];
    const { words } = JSON.parse(msg.data).channel.alternatives[0];
    words.forEach((word) => {
      word.speaker_name = `Speaker-${word.speaker}`;
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
    const { transcript } = JSON.parse(msg.data).channel.alternatives[0];
    const { words } = JSON.parse(msg.data).channel.alternatives[0];
    words.forEach((word) => {
      word.speaker_name = "Me";
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
