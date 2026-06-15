using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Shouldly;

namespace AmbientWeather.IntegrationTests.Swagger;

/// <summary>
/// Verifies that the committed OpenAPI snapshot at <c>docs/openapi.json</c> matches the
/// current API surface. Run <c>npm run swagger:generate</c> to regenerate the snapshot
/// after intentional DTO or route changes, then commit the updated file.
/// </summary>
public sealed class SwaggerContractTests : IClassFixture<TestApplicationFactory>
{
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new()
    {
        WriteIndented = true,
        NewLine = "\n", // repo mandates LF; avoids CRLF churn when regenerating on Windows
    };

    private readonly TestApplicationFactory _factory;

    /// <summary>Initializes a new instance of <see cref="SwaggerContractTests"/>.</summary>
    public SwaggerContractTests(TestApplicationFactory factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// Fetches the live OpenAPI document from the swagger endpoint and compares it against
    /// the committed snapshot. Set the environment variable
    /// <c>UPDATE_SWAGGER_SNAPSHOT=true</c> (via <c>npm run swagger:generate</c>) to
    /// overwrite the snapshot instead of comparing.
    /// </summary>
    [Fact]
    public async Task SwaggerDocumentMatchesCommittedSnapshot()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/swagger/v1/swagger.json");
        response.StatusCode.ShouldBe(HttpStatusCode.OK, "Swagger endpoint must return 200 in the Testing environment.");

        var raw = await response.Content.ReadAsStringAsync();
        var current = NormalizeJson(raw);
        var snapshotPath = FindSnapshotPath();

        var updateSnapshot = string.Equals(
            Environment.GetEnvironmentVariable("UPDATE_SWAGGER_SNAPSHOT"),
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (updateSnapshot)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(snapshotPath)!);
            File.WriteAllText(snapshotPath, current);
            return;
        }

        File.Exists(snapshotPath).ShouldBeTrue(
            $"OpenAPI snapshot not found at '{snapshotPath}'. Run `npm run swagger:generate` to create it.");

        var committed = NormalizeJson(File.ReadAllText(snapshotPath));
        if (!string.Equals(current, committed, StringComparison.Ordinal))
        {
            var currentLines = current.Split('\n');
            var committedLines = committed.Split('\n');
            var diffs = new List<string>
            {
                $"OpenAPI snapshot is out of date (current={currentLines.Length} lines, committed={committedLines.Length} lines).",
                "Run `npm run swagger:generate` after intentional DTO changes, then commit docs/openapi.json.",
                "First 20 differing lines:",
            };
            int shown = 0;
            int maxLine = Math.Max(currentLines.Length, committedLines.Length);
            for (int i = 0; i < maxLine && shown < 20; i++)
            {
                var cur = i < currentLines.Length ? currentLines[i] : "<missing>";
                var com = i < committedLines.Length ? committedLines[i] : "<missing>";
                if (!string.Equals(cur, com, StringComparison.Ordinal))
                {
                    diffs.Add($"  Line {i + 1} CURRENT:   {cur}");
                    diffs.Add($"  Line {i + 1} COMMITTED: {com}");
                    shown++;
                }
            }
            Assert.Fail(string.Join(Environment.NewLine, diffs));
        }
    }

    /// <summary>
    /// Walks up from the test output directory to find the repository root, identified by
    /// the presence of both <c>backend/</c> and <c>frontend/</c> subdirectories.
    /// </summary>
    private static string FindSnapshotPath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "backend"))
                && Directory.Exists(Path.Combine(dir.FullName, "frontend")))
                break;
            dir = dir.Parent;
        }

        dir.ShouldNotBeNull(
            "Cannot locate repository root (containing backend/ and frontend/) from test output directory.");
        return Path.Combine(dir!.FullName, "docs", "openapi.json");
    }

    /// <summary>
    /// Normalizes JSON by removing Testing-only endpoints and sorting all object keys
    /// recursively for stable diffs.
    /// </summary>
    private static string NormalizeJson(string json)
    {
        var node = JsonNode.Parse(json);
        RemoveTestOnlyEndpoints(node);
        var serialized = SortNode(node)?.ToJsonString(SnapshotJsonOptions) ?? "null";
        // The committed snapshot is generated on Windows, where the C# compiler embeds
        // \r\n (the 4-char JSON escape sequence) in multi-line XML doc comments.
        // Linux emits only \n. Replace the 4-char sequence so both sides normalize
        // identically regardless of which platform generated the input.
        return serialized.Replace(@"\r\n", @"\n", StringComparison.Ordinal);
    }

    /// <summary>
    /// Strips the <c>/test/*</c> exception-test endpoints (mapped only in the Testing
    /// environment) and their tag so the snapshot reflects the real API surface.
    /// </summary>
    private static void RemoveTestOnlyEndpoints(JsonNode? root)
    {
        if (root is not JsonObject doc) return;

        if (doc["paths"] is JsonObject paths)
        {
            var testPaths = paths
                .Select(kv => kv.Key)
                .Where(key => key.StartsWith("/test/", StringComparison.Ordinal))
                .ToList();
            foreach (var key in testPaths)
                paths.Remove(key);
        }

        if (doc["tags"] is JsonArray tags)
        {
            for (var i = tags.Count - 1; i >= 0; i--)
            {
                if (tags[i] is JsonObject tag
                    && tag["name"]?.GetValue<string>() is "Program")
                    tags.RemoveAt(i);
            }
        }
    }

    private static JsonNode? SortNode(JsonNode? node) => node switch
    {
        JsonObject obj => SortObject(obj),
        JsonArray arr => SortArray(arr),
        _ => node?.DeepClone(),
    };

    private static JsonObject SortObject(JsonObject obj)
    {
        var sorted = new JsonObject();
        foreach (var (key, value) in obj.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            sorted[key] = SortNode(value);
        return sorted;
    }

    private static JsonArray SortArray(JsonArray arr)
    {
        // Sort arrays whose elements are all strings (e.g. "required", "tags", "enum").
        // Reflection order for these varies between Linux and Windows, causing snapshot
        // mismatches in CI even when the API surface is identical.
        if (arr.All(item => item is JsonValue v && v.GetValueKind() == System.Text.Json.JsonValueKind.String))
        {
            var sorted = new JsonArray();
            foreach (var item in arr
                .Select(item => item!.GetValue<string>())
                .Order(StringComparer.Ordinal))
                sorted.Add(JsonValue.Create(item));
            return sorted;
        }

        var result = new JsonArray();
        foreach (var item in arr)
            result.Add(SortNode(item));
        return result;
    }
}
