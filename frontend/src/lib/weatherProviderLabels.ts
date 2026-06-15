/** User-facing label for public and neighbor weather providers. */
export function weatherProviderLabel(provider: string): string {
  switch (provider) {
    case 'WeatherGov':
      return 'Weather.gov';
    case 'OpenMeteo':
      return 'Open-Meteo';
    case 'AmbientOpen':
      return 'Ambient Open';
    default:
      return provider;
  }
}
