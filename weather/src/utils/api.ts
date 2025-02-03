const OPEN_WEATHER_API_KEY = 'e6cedfb5c2d419dcea2de723648f1ae8';

export interface OpenWeatherData {
    name: string;
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        pressure: number;
        humidity: number;
        sea_level: number;
        grnd_level: number;
    };
    weather: {
        id: number;
        main: string;
        description: string;
        icon: string;
    }[];
    wind: {
        speed: number;
        deg: number;
        gust: number;
    };
}



export const fetchOpenWeatherData = async (city: string): Promise<any> => {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${OPEN_WEATHER_API_KEY}`);
    if (!response.ok) {
        throw new Error('Failed to fetch data');
    }

    const data: OpenWeatherData = await response.json();
    return data;
}