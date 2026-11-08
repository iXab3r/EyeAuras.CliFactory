using System.Text.Json;
using System.Text.Json.Nodes;
using Cake.Core;
using Cake.Frosting;

[TaskName("Verify")]
public sealed class VerifyTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        await context.Run("dotnet", "run", "--file", "scripts/bootstrap.cs");
        Console.WriteLine(await context.Run("npm", ["run", "browser:install", "--", .. (OperatingSystem.IsLinux() && Environment.GetEnvironmentVariable("CI") == "true" ? new[] { "--with-deps" } : Array.Empty<string>())]));
        Console.WriteLine(OperatingSystem.IsLinux() && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DISPLAY"))
            ? await context.Run("xvfb-run", "--auto-servernum", "npm", "test")
            : await context.Run("npm", "test"));
        Console.WriteLine(await context.Run("npm", "run", "test:packages"));
        Console.WriteLine(await context.Run("node", "--test", "scripts/test-release.mjs"));
    }
}

[TaskName("SetVersion")]
public sealed class SetVersionTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        var version = context.RequireVersion();
        var files = new[] { "packages", "integrations" }.SelectMany(folder => Directory.GetDirectories(Path.Combine(context.Root, folder)))
            .Select(directory => Path.Combine(directory, "package.json")).Where(File.Exists);
        foreach (var path in files)
        {
            var json = JsonNode.Parse(File.ReadAllText(path))!;
            if (json["name"]!.GetValue<string>() == BuildContext.PackageName) json["version"] = version;
            if (json["dependencies"] is JsonObject dependencies && dependencies.ContainsKey(BuildContext.PackageName))
                dependencies[BuildContext.PackageName] = version;
            File.WriteAllText(path, json.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
        }
        await context.Run("npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund");
        context.CheckVersions();
    }
}

[TaskName("CheckRelease")]
public sealed class CheckReleaseTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        context.CheckVersions();
        var revision = Environment.GetEnvironmentVariable("RELEASE_REVISION") ?? "";
        if (!System.Text.RegularExpressions.Regex.IsMatch(revision, "^[0-9a-f]{40}$") || revision != await context.Run("git", "rev-parse", "HEAD"))
            throw new CakeException("RELEASE_REVISION must equal the full checkout SHA.");
        if (context.DryRun) return;
        if ((await context.Run("git", "status", "--porcelain")).Length > 0) throw new CakeException("A live release requires a clean working tree.");
    }
}

[TaskName("Pack")]
[IsDependentOn(typeof(CheckReleaseTask))]
[IsDependentOn(typeof(VerifyTask))]
public sealed class PackTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        Directory.CreateDirectory(context.ReleaseDirectory);
        using var packed = JsonDocument.Parse(await context.Run("npm", "pack", "--json", "--ignore-scripts", "--pack-destination", context.ReleaseDirectory, "--workspace", BuildContext.PackageName));
        var package = packed.RootElement[0];
        if (package.GetProperty("version").GetString() != context.RequireVersion()) throw new CakeException("Packed version differs from release version.");
        var manifest = new {
            name = package.GetProperty("name").GetString(), version = context.RequireVersion(),
            commit = await context.Run("git", "rev-parse", "HEAD"),
            file = package.GetProperty("filename").GetString(), shasum = package.GetProperty("shasum").GetString(),
            integrity = package.GetProperty("integrity").GetString(),
        };
        File.WriteAllText(Path.Combine(context.ReleaseDirectory, "release-manifest.json"),
            JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }) + "\n");
        Console.WriteLine(await context.Run("npm", "run", "test:packages", "--", "--tarball", Path.Combine(context.ReleaseDirectory, manifest.file!)));
    }
}
