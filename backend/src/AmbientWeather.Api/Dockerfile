# syntax=docker/dockerfile:1
# Build context is the repo root (see docker-compose.prod.yml) so project references resolve.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/src/AmbientWeather.Api/AmbientWeather.Api.csproj backend/src/AmbientWeather.Api/
COPY backend/src/AmbientWeather.Application/AmbientWeather.Application.csproj backend/src/AmbientWeather.Application/
COPY backend/src/AmbientWeather.Domain/AmbientWeather.Domain.csproj backend/src/AmbientWeather.Domain/
COPY backend/src/AmbientWeather.Infrastructure/AmbientWeather.Infrastructure.csproj backend/src/AmbientWeather.Infrastructure/
RUN dotnet restore backend/src/AmbientWeather.Api/AmbientWeather.Api.csproj

COPY backend/src/AmbientWeather.Api/ backend/src/AmbientWeather.Api/
COPY backend/src/AmbientWeather.Application/ backend/src/AmbientWeather.Application/
COPY backend/src/AmbientWeather.Domain/ backend/src/AmbientWeather.Domain/
COPY backend/src/AmbientWeather.Infrastructure/ backend/src/AmbientWeather.Infrastructure/

RUN dotnet publish backend/src/AmbientWeather.Api/AmbientWeather.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "AmbientWeather.Api.dll"]
