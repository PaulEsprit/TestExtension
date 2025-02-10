import { setStoradeCities, setStorageOptions } from "../utils/storage";

// TODO: background script
chrome.runtime.onInstalled.addListener(() => {
  setStoradeCities([])
  .then(() => {})
  .catch(error => console.error(error));

  setStorageOptions({
    homeCity: '',
    tempScale: 'metric'
  })
  .then(() => {})
  .catch(error => console.error(error));
});
