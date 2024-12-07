const api = document.getElementById('api')
const language = document.getElementById('language')
const button = document.querySelector('button')


chrome.storage.local.get(['key', 'language'], ({ key, language: savedLanguage }) => {
  if (key) api.value = key;
  if (savedLanguage) language.value = savedLanguage;
});

document.querySelectorAll(".button-save").forEach((button) => {
  button.addEventListener("click", saveOptions);
});

function saveOptions() {
  const key = api.value;
  const selectedLanguage = language.value;

  chrome.storage.local.set({ key, language: selectedLanguage }, () => {
    alert('Deepgram API Key and Language Set');
  });
}

