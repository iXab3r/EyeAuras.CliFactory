using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Cake.Core;
using Cake.Frosting;

return new CakeHost().UseContext<BuildContext>().Run(args);

/// <summary>Repository-local process and version context for the single public package.</summary>
public sealed class BuildContext(ICakeContext context) : FrostingContext(context)
{
    public const string PackageName = "@eyeauras/cli-factory";
    public const string PackageDirectory = "packages/core";
    public string Root { get; } = FindRoot();
    public string ReleaseDirectory => Path.Combine(Root, "output", "release");
    public bool DryRun => Arguments.HasArgument("dry-run");
    public string RequireVersion()
    {
        var version = Arguments.HasArgument("release-version") ? Arguments.GetArgument("release-version") : "";
        return Regex.IsMatch(version, @"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$") ? version
            : throw new CakeException("Pass --release-version <major.minor.patch>.");
    }

    public Task<string> Run(string tool, params string[] arguments) => RunAt(Root, tool, arguments);

    public async Task<string> RunAt(string directory, string tool, string[] arguments, IReadOnlyDictionary<string, string>? credentials = null)
    {
        var executable = !OperatingSystem.IsWindows() ? tool : (Environment.GetEnvironmentVariable("PATH") ?? "")
            .Split(Path.PathSeparator).Where(path => path.Trim().Length > 0)
            .SelectMany(path => new[] { ".cmd", ".exe" }.Select(ext => Path.Combine(path.Trim(), tool + ext)))
            .FirstOrDefault(File.Exists) ?? tool;
        var start = new ProcessStartInfo(executable) { WorkingDirectory = directory, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
        var safe = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "PATH", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT",
            "TEMP", "TMP", "TMPDIR", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "XDG_RUNTIME_DIR",
            "DOTNET_ROOT", "DOTNET_ROOT_X64", "DOTNET_CLI_HOME", "DOTNET_NOLOGO", "DOTNET_CLI_TELEMETRY_OPTOUT",
            "NUGET_PACKAGES", "CI", "LANG", "LC_ALL", "DISPLAY", "XAUTHORITY", "PLAYWRIGHT_BROWSERS_PATH"
        };
        foreach (var key in start.Environment.Keys.Where(key => !safe.Contains(key)).ToArray()) start.Environment.Remove(key);
        start.Environment["GIT_CONFIG_COUNT"] = "1";
        start.Environment["GIT_CONFIG_KEY_0"] = "safe.directory";
        start.Environment["GIT_CONFIG_VALUE_0"] = Root;
        string? npmDirectory = null;
        {
            npmDirectory = Path.Combine(Path.GetTempPath(), "factory-npm-" + Guid.NewGuid());
            if (OperatingSystem.IsWindows()) Directory.CreateDirectory(npmDirectory);
            else Directory.CreateDirectory(npmDirectory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            foreach (var name in new[] { "npmrc", "global-npmrc" }) File.WriteAllText(Path.Combine(npmDirectory, name), "");
            start.Environment["NPM_CONFIG_USERCONFIG"] = Path.Combine(npmDirectory, "npmrc");
            start.Environment["NPM_CONFIG_GLOBALCONFIG"] = Path.Combine(npmDirectory, "global-npmrc");
            start.Environment["NPM_CONFIG_REGISTRY"] = "https://registry.npmjs.org/";
            if (tool == "npm")
            {
                if (arguments.FirstOrDefault() != "--registry") arguments = ["--registry", "https://registry.npmjs.org/", .. arguments];
                else if (arguments.Length < 2 || arguments[1] != "https://registry.npmjs.org/") throw new CakeException("Use the public npm registry.");
            }
        }
        try
        {
            if (credentials is not null)
                foreach (var pair in credentials) start.Environment[pair.Key] = pair.Value;
            foreach (var argument in arguments) start.ArgumentList.Add(argument);
            Console.WriteLine($"> {tool} {string.Join(' ', arguments)}");
            using var process = Process.Start(start) ?? throw new CakeException($"Could not start {tool}.");
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            var output = await stdout;
            var diagnostic = await stderr;
            await process.WaitForExitAsync();
            if (process.ExitCode == 0 && (tool != "npm" || !arguments.Contains("stage")))
                Console.Write(diagnostic);
            if (process.ExitCode != 0)
            {
                // npm may include credentials or registry responses in its diagnostics.
                var code = Regex.Match(diagnostic + output, @"\bE(?:403|404)\b").Value;
                throw new CakeException($"{tool} exited with code {process.ExitCode}{(code.Length > 0 ? $" ({code}); ask the owner before retrying" : "")}.");
            }
            return output.Trim();
        }
        finally { if (npmDirectory is not null) Directory.Delete(npmDirectory, recursive: true); }
    }

    public void CheckVersions()
    {
        var version = RequireVersion();
        using var package = JsonDocument.Parse(File.ReadAllText(Path.Combine(Root, PackageDirectory, "package.json")));
        using var lockfile = JsonDocument.Parse(File.ReadAllText(Path.Combine(Root, "package-lock.json")));
        var locked = lockfile.RootElement.GetProperty("packages");
        if (package.RootElement.GetProperty("name").GetString() != PackageName
            || package.RootElement.GetProperty("version").GetString() != version
            || locked.GetProperty(PackageDirectory).GetProperty("version").GetString() != version)
            throw new CakeException("Core package and lockfile must match --release-version.");
        foreach (var entry in locked.EnumerateObject().Where(entry => !entry.Name.Contains("node_modules")))
            if (entry.Value.TryGetProperty("dependencies", out var dependencies)
                && dependencies.TryGetProperty(PackageName, out var pin) && pin.GetString() != version)
                throw new CakeException("Workspace Core pins must match --release-version.");
    }

    private static string FindRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "build", "Build.csproj"))) return directory.FullName;
        throw new CakeException("Run from a cli-factory checkout.");
    }
}
