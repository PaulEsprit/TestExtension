import { OpenWeatherTempScale } from "./api"

export interface LocalStorage {
    cities?: string[],
    options?: LocalStorageOptions
}

export interface LocalStorageOptions {
    homeCity?: string,
    tempScale: OpenWeatherTempScale
}

export type LocalStorageKeys = keyof LocalStorage

export function setStoradeCities(cities: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const storage: LocalStorage = {
            cities
        }
        chrome.storage.local.set(storage, () => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError)
            }
            resolve()
        })
    })
}

export function getStoradeCities(): Promise<string[]> {
    const keys:LocalStorageKeys[] = ['cities']

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (storage:LocalStorage) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError)
            }
            resolve(storage.cities || [])
        })
    })
}

export function setStorageOptions(options: LocalStorageOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const storage: LocalStorage = {
            options
        }
        chrome.storage.local.set(storage, () => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError)
            }
            resolve()
        })
    })
}

export function getStorageOptions(): Promise<LocalStorageOptions> {
    const keys:LocalStorageKeys[] = ['options']

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (storage:LocalStorage) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError)
            }
            resolve(storage.options)
        })
    })
}