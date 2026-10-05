# Build context: ./backend   (docker build -f FieldOps.Api/Dockerfile .)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first (cached layer unless a csproj changes)
COPY FieldOps.Domain/FieldOps.Domain.csproj FieldOps.Domain/
COPY FieldOps.Application/FieldOps.Application.csproj FieldOps.Application/
COPY FieldOps.Infrastructure/FieldOps.Infrastructure.csproj FieldOps.Infrastructure/
COPY FieldOps.Api/FieldOps.Api.csproj FieldOps.Api/
RUN dotnet restore FieldOps.Api/FieldOps.Api.csproj

COPY FieldOps.Domain/ FieldOps.Domain/
COPY FieldOps.Application/ FieldOps.Application/
COPY FieldOps.Infrastructure/ FieldOps.Infrastructure/
COPY FieldOps.Api/ FieldOps.Api/
RUN dotnet publish FieldOps.Api/FieldOps.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# QuestPDF (SkiaSharp) needs fontconfig/freetype on Linux; curl is used by the container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libfontconfig1 libfreetype6 fonts-dejavu-core curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Uploaded job photos live here - mount a volume to persist them.
RUN mkdir -p /app/uploads && chown -R app:app /app/uploads
USER app

ENV ASPNETCORE_URLS=http://+:8080 \
    FileStorage__RootPath=/app/uploads \
    DOTNET_RUNNING_IN_CONTAINER=true
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "FieldOps.Api.dll"]
