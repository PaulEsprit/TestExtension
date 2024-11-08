const api = document.getElementById('api')
const button = document.querySelector('button')

chrome.storage.local.get('deepGramApiKey', ( key ) => {
  if(key) api.value = key.deepGramApiKey
})

button.addEventListener('click', () => {
  const key = api.value
  chrome.storage.local.set({ deepGramApiKey:key }, () => {
    alert('Deepgram API Key Set')
  })
})
