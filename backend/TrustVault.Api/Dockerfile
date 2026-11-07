FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY TrustVault.Api/TrustVault.Api.csproj TrustVault.Api/
RUN dotnet restore TrustVault.Api/TrustVault.Api.csproj
COPY . .
RUN dotnet publish TrustVault.Api/TrustVault.Api.csproj -c Release -o /app/publish
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/private-storage && chown -R app:app /app
USER app
EXPOSE 5106
ENTRYPOINT ["dotnet", "TrustVault.Api.dll"]
