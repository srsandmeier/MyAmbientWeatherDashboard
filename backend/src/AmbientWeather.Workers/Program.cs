using AmbientWeather.Infrastructure;
using AmbientWeather.Workers;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
builder.Services.Configure<HistorySyncWorkerOptions>(
    builder.Configuration.GetSection("HistorySync"));
builder.Services.AddHostedService<HistorySyncWorker>();

var host = builder.Build();
host.Run();
