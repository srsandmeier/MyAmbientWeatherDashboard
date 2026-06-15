// Generates (or updates) docs/openapi.json by running the SwaggerContractTests
// integration test with UPDATE_SWAGGER_SNAPSHOT=true.
// Run via: npm run swagger:generate

import { spawnSync } from 'child_process';

const result = spawnSync(
  'dotnet',
  [
    'test', 'backend/tests/AmbientWeather.IntegrationTests/AmbientWeather.IntegrationTests.csproj',
    '--configuration', 'Release',
    '--filter', 'FullyQualifiedName~SwaggerContractTests',
  ],
  {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, UPDATE_SWAGGER_SNAPSHOT: 'true' },
  },
);

process.exit(result.status ?? 1);
