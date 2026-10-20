export type WeatherData = {
  name: string;

  main: {
    temp: number;
    humidity: number;
  };

  weather: {
    main: string;
    description: string;
  }[];

  wind: {
    speed: number;
  };
};