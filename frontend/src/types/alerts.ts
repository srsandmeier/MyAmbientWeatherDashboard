export interface WeatherAlertDto {
  readonly id: string;
  readonly event: string | null;
  readonly headline: string | null;
  readonly description: string | null;
  readonly severity: string | null;
  readonly urgency: string | null;
  readonly certainty: string | null;
  readonly effectiveUtc: string | null;
  readonly expiresUtc: string | null;
  readonly areaDesc: string | null;
}
