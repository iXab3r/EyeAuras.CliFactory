using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Cake.Core;
using Cake.Frosting;

return new CakeHost().UseContext<BuildContext>().Run(args);

public sealed record ReleasePackage(string Name, string File, string Shasum, string Integrity);
public sealed record ReleaseManifest(string Version, string Commit, List<ReleasePackage> Packages);

/// <summary>Arguments and process helpers shared by the release tasks; local and CI runs are identical.</summary>
public sealed class BuildContext : FrostingContext
{
    /// <summary>The public packages in dependency order.</summary>
    public static readonly string[] Packages = ["@eyeauras/cli-factory", "@eyeauras/youtrack-cli", "@eyeauras/teamcity-cli"];
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public string Root { get; } = FindRoot();
    public string? Version { get; }
    public bool DryRun { get; }
    public bool GitHubActions { get; } = System.Environment.GetEnvironmentVariable("GITHUB_ACTIONS") == "true";
    public string ReleaseDirectory => Path.Combine(Root, "output", "release");
    public string ManifestPath => Path.Combine(ReleaseDirectory, "release-manifest.json");

    public BuildContext(ICakeContext context) : base(context)
    {
        // Cake reserves --version for itself, hence --release-version.
        Version = context.Arguments.HasArgument("release-version") ? context.Arguments.GetArgument("release-version") : null;
        DryRun = context.Arguments.HasArgument("dry-run");
    }

    public string RequireVersion() => Version is { } version && Regex.IsMatch(version, @"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$")
        ? version
        : throw new CakeException("Pass --release-version <major.minor.patch>.");

    public ReleaseManifest ReadManifest()
    {
        var manifest = JsonSerializer.Deserialize<ReleaseManifest>(File.ReadAllText(ManifestPath), Json)!;
        return manifest.Version == RequireVersion()
            ? manifest
            : throw new CakeException("output/release belongs to another version; run the Pack target.");
    }

    /// <summary>Runs a tool from the repository root. Without capture the console stays attached, so npm can
    /// ask for local 2FA; with capture only stdout is collected.</summary>
    public async Task<(int ExitCode, string Output)> Exec(
        string tool, IEnumerable<string> arguments, bool capture = false, bool check = true)
    {
        var info = new ProcessStartInfo(Resolve(tool))
        {
            WorkingDirectory = Root,
            UseShellExecute = false,
            RedirectStandardOutput = capture,
        };
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        Console.WriteLine($"> {tool} {string.Join(' ', info.ArgumentList)}");
        using var process = Process.Start(info) ?? throw new CakeException($"Could not start {tool}.");
        var output = capture ? await process.StandardOutput.ReadToEndAsync() : "";
        await process.WaitForExitAsync();
        if (check && process.ExitCode != 0) throw new CakeException($"{tool} exited with code {process.ExitCode}.");
        return (process.ExitCode, output.Trim());
    }

    public Task Run(string tool, params string[] arguments) => Exec(tool, arguments);

    public async Task<string> Read(string tool, params string[] arguments) =>
        (await Exec(tool, arguments, capture: true)).Output;

    // Windows starts a bare "npm.cmd" in a way that makes the shim resolve %~dp0 to the working
    // directory, so pass the full path of the first PATH match, as the shell would.
    private static string Resolve(string tool) => !OperatingSystem.IsWindows() ? tool
        : (System.Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)
            .Where(directory => directory.Trim().Length > 0)
            .SelectMany(directory => new[] { ".cmd", ".exe" }.Select(extension => Path.Combine(directory.Trim(), tool + extension)))
            .FirstOrDefault(File.Exists) ?? tool;

    private static string FindRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "build", "Build.csproj"))) return directory.FullName;
        }
        throw new CakeException("The release driver must run from a CLI Factory checkout.");
    }
}

/// <summary>Every place that carries the release version: public manifests, CLI versions, Core pins, lockfile.</summary>
public static class Versions
{
    private static readonly (string File, string Pattern)[] Sites =
    [
        ("packages/core/package.json", "^  \"version\": \"([^\"]+)\""),
        ("integrations/youtrack/package.json", "^  \"version\": \"([^\"]+)\""),
        ("integrations/teamcity/package.json", "^  \"version\": \"([^\"]+)\""),
        ("integrations/youtrack/src/cli.ts", "^    version: \"([^\"]+)\","),
        ("integrations/teamcity/src/cli.ts", "^    version: \"([^\"]+)\","),
    ];
    private static readonly Regex CorePin = new("\"@eyeauras/cli-factory\": \"([^\"]+)\"");

    private static IEnumerable<(string File, Regex Pattern, bool Required)> All(string root) =>
        Sites.Select(site => (site.File, new Regex(site.Pattern, RegexOptions.Multiline), true))
            .Concat(new[] { "packages", "integrations" }
                .SelectMany(folder => Directory.GetDirectories(Path.Combine(root, folder)))
                .Select(directory => Path.GetRelativePath(root, Path.Combine(directory, "package.json")).Replace('\\', '/'))
                .Where(file => File.Exists(Path.Combine(root, file)))
                .Select(file => (file, CorePin, false)));

    public static void Set(string root, string version)
    {
        foreach (var (file, pattern, _) in All(root))
        {
            var path = Path.Combine(root, file);
            File.WriteAllText(path, pattern.Replace(File.ReadAllText(path),
                match => match.Value.Replace(match.Groups[1].Value, version)));
        }
    }

    /// <summary>Throws with every site that does not carry the version, including stale lockfile entries.</summary>
    public static void Check(string root, string version)
    {
        var problems = new List<string>();
        foreach (var (file, pattern, required) in All(root))
        {
            var matches = pattern.Matches(File.ReadAllText(Path.Combine(root, file)));
            if (required && matches.Count != 1) problems.Add($"{file}: version not found");
            problems.AddRange(matches.Where(match => match.Groups[1].Value != version)
                .Select(match => $"{file}: {match.Groups[1].Value}"));
        }
        using var lockfile = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "package-lock.json")));
        foreach (var entry in lockfile.RootElement.GetProperty("packages").EnumerateObject()
                     .Where(entry => entry.Name.Length > 0 && !entry.Name.Contains("node_modules")))
        {
            if (Sites.Any(site => site.File == entry.Name + "/package.json")
                && entry.Value.GetProperty("version").GetString() != version)
                problems.Add($"package-lock.json {entry.Name}: {entry.Value.GetProperty("version").GetString()}");
            if (entry.Value.TryGetProperty("dependencies", out var dependencies)
                && dependencies.TryGetProperty("@eyeauras/cli-factory", out var pin) && pin.GetString() != version)
                problems.Add($"package-lock.json {entry.Name} Core pin: {pin.GetString()}");
        }
        if (problems.Count > 0)
            throw new CakeException($"Release version {version} does not match:{Environment.NewLine}  " +
                string.Join(Environment.NewLine + "  ", problems));
    }
}
