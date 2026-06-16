# syntax=docker/dockerfile:1
# Build context is the repo root (see docker-compose.prod.yml) so project references resolve.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/src/AmbientWeather.Workers/AmbientWeather.Workers.csproj backend/src/AmbientWeather.Workers/
COPY backend/src/AmbientWeather.Application/AmbientWeather.Application.csproj backend/src/AmbientWeather.Application/
COPY backend/src/AmbientWeather.Domain/AmbientWeather.Domain.csproj backend/src/AmbientWeather.Domain/
COPY backend/src/AmbientWeather.Infrastructure/AmbientWeather.Infrastructure.csproj backend/src/AmbientWeather.Infrastructure/
RUN dotnet restore backend/src/AmbientWeather.Workers/AmbientWeather.Workers.csproj

COPY backend/src/AmbientWeather.Workers/ backend/src/AmbientWeather.Workers/
COPY backend/src/AmbientWeather.Application/ backend/src/AmbientWeather.Application/
COPY backend/src/AmbientWeather.Domain/ backend/src/AmbientWeather.Domain/
COPY backend/src/AmbientWeather.Infrastructure/ backend/src/AmbientWeather.Infrastructure/

RUN dotnet publish backend/src/AmbientWeather.Workers/AmbientWeather.Workers.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "AmbientWeather.Workers.dll"]
