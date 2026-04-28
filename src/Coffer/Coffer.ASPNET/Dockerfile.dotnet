FROM mcr.microsoft.com/dotnet/sdk:8.0

WORKDIR /app

# copy only csproj first for caching
COPY Coffer.sln .
COPY Coffer/Coffer.ASPNET/*.csproj Coffer/Coffer.ASPNET/
COPY Coffer/Coffer.BusinessLogic/*.csproj Coffer/Coffer.BusinessLogic/
COPY Coffer/Coffer.DataAccess/*.csproj Coffer/Coffer.DataAccess/
COPY Coffer/Coffer.Domain/*.csproj Coffer/Coffer.Domain/
COPY Coffer/Coffer.Infrastructure/*.csproj Coffer/Coffer.Infrastructure/

RUN dotnet restore Coffer/Coffer.ASPNET/Coffer.ASPNET.csproj

# install hot reload tool
RUN dotnet tool install -g dotnet-watch

ENV PATH="$PATH:/root/.dotnet/tools"

EXPOSE 80

WORKDIR /app

CMD ["dotnet", "watch", "run", "--project", "Coffer/Coffer.ASPNET/Coffer.ASPNET.csproj", "--urls", "http://0.0.0.0:80"]