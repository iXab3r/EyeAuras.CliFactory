using System.Text.Json;
using Cake.Core;
using Cake.Core.Diagnostics;
using Cake.Frosting;

[TaskName("Verify")]
[TaskDescription("Install, build and test the workspace, then check the package archives.")]
public sealed class VerifyTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        // The documented bootstrap (submodules, then npm ci), so every CI platform exercises it.
        await context.Run("dotnet", "run", "--file", "scripts/bootstrap.cs");
        await context.Exec("npm", context.GitHubActions
            ? ["run", "browser:install", "--", "--with-deps"]
            : ["run", "browser:install"]);
        // Headless Linux CI has no display; the browser tests run under a virtual X server there.
        if (OperatingSystem.IsLinux() && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DISPLAY")))
            await context.Run("xvfb-run", "--auto-servernum", "npm", "test");
        else
            await context.Run("npm", "test");
        await context.Run("npm", "run", "test:packages");
    }
}

[TaskName("SetVersion")]
[TaskDescription("Write --release-version to every version site and refresh the lockfile.")]
public sealed class SetVersionTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        var version = context.RequireVersion();
        Versions.Set(context.Root, version);
        await context.Run("npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund");
        Versions.Check(context.Root, version);
    }
}

[TaskName("CheckRelease")]
[TaskDescription("Fail before any work unless the version, and for a live release the source, are releasable.")]
public sealed class CheckReleaseTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        Versions.Check(context.Root, context.RequireVersion());
        if (context.DryRun) return;
        await RequireReleasableSource(context);
        if (context.GitHubActions && System.Version.Parse(await context.Read("npm", "--version")) < new System.Version(11, 5, 1))
            throw new CakeException("Trusted publishing needs npm 11.5.1+; install the root packageManager version.");
    }

    /// <summary>Returns the clean origin/main tip; Publish repeats this so --exclusive cannot bypass it.</summary>
    public static async Task<string> RequireReleasableSource(BuildContext context)
    {
        if ((await context.Read("git", "status", "--porcelain")).Length > 0)
            throw new CakeException("A live release requires a clean working tree.");
        await context.Run("git", "fetch", "--quiet", "origin", "main");
        var head = await context.Read("git", "rev-parse", "HEAD");
        return head == await context.Read("git", "rev-parse", "FETCH_HEAD")
            ? head
            : throw new CakeException("A live release requires HEAD to be the current origin/main tip.");
    }
}

[TaskName("Pack")]
[TaskDescription("Pack the public packages into output/release and write release-manifest.json.")]
[IsDependentOn(typeof(CheckReleaseTask))]
[IsDependentOn(typeof(VerifyTask))]
public sealed class PackTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        var version = context.RequireVersion();
        if (Directory.Exists(context.ReleaseDirectory)) Directory.Delete(context.ReleaseDirectory, recursive: true);
        Directory.CreateDirectory(context.ReleaseDirectory);
        // Verify has just built the workspace; test:packages packs the same way with scripts suppressed.
        using var packed = JsonDocument.Parse(await context.Read("npm", [
            "pack", "--json", "--ignore-scripts", "--pack-destination", context.ReleaseDirectory,
            .. BuildContext.Packages.SelectMany(name => new[] { "--workspace", name }),
        ]));
        var packages = packed.RootElement.EnumerateArray()
            .Select(item => (Version: item.GetProperty("version").GetString(), Package: new ReleasePackage(
                item.GetProperty("name").GetString()!, item.GetProperty("filename").GetString()!,
                item.GetProperty("shasum").GetString()!, item.GetProperty("integrity").GetString()!)))
            .OrderBy(item => Array.IndexOf(BuildContext.Packages, item.Package.Name))
            .ToList();
        if (packages.Count != BuildContext.Packages.Length || packages.Any(item => item.Version != version))
            throw new CakeException("npm pack did not produce the three public packages at the release version.");
        var manifest = new ReleaseManifest(version, await context.Read("git", "rev-parse", "HEAD"),
            packages.Select(item => item.Package).ToList());
        File.WriteAllText(context.ManifestPath, JsonSerializer.Serialize(manifest, BuildContext.Json));
    }
}

[TaskName("Publish")]
[TaskDescription("Publish the packed archives in dependency order; --dry-run only simulates it.")]
[IsDependentOn(typeof(PackTask))]
public sealed class PublishTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        var manifest = context.ReadManifest();
        if (!context.DryRun && await CheckReleaseTask.RequireReleasableSource(context) != manifest.Commit)
            throw new CakeException("output/release was packed from another commit; run the Pack target.");
        foreach (var package in manifest.Packages)
        {
            var published = await PublishedShasum(context, package.Name, manifest.Version);
            if (published == package.Shasum)
            {
                context.Log.Information("{0}@{1} is already published with this content; skipped.", package.Name, manifest.Version);
                continue;
            }
            if (published is not null)
            {
                // Ordinary PRs change content without a version bump; only a live release must refuse.
                // npm cannot simulate publishing over an existing version, so a dry run just reports it.
                if (!context.DryRun)
                    throw new CakeException($"{package.Name}@{manifest.Version} is already published with different content.");
                context.Log.Warning("{0}@{1} is already published with different content; a live release needs SetVersion.",
                    package.Name, manifest.Version);
                continue;
            }
            string[] publish = ["publish", Path.Combine(context.ReleaseDirectory, package.File), "--access", "public"];
            await context.Exec("npm", context.DryRun ? [.. publish, "--dry-run"] : publish);
            if (context.DryRun) continue;
            // Wait until the registry serves the version: the next packages depend on it.
            for (var attempt = 1; (published = await PublishedShasum(context, package.Name, manifest.Version)) is null; attempt++)
            {
                if (attempt == 60) throw new CakeException($"{package.Name}@{manifest.Version} did not appear in the registry.");
                await Task.Delay(TimeSpan.FromSeconds(10));
            }
            if (published != package.Shasum)
                throw new CakeException($"The registry shasum of {package.Name}@{manifest.Version} differs from the packed archive.");
        }
    }

    private static async Task<string?> PublishedShasum(BuildContext context, string name, string version)
    {
        var (exitCode, output) = await context.Exec("npm",
            ["view", $"{name}@{version}", "dist.shasum", "--json", "--prefer-online", "--registry", "https://registry.npmjs.org/"],
            capture: true, check: false);
        if (exitCode != 0)
            return output.Contains("\"E404\"") ? null : throw new CakeException($"npm view {name}@{version} failed.");
        return output.Length > 0 ? JsonSerializer.Deserialize<string>(output) : null;
    }
}

[TaskName("VerifyRegistry")]
[TaskDescription("Install the published CLIs from the registry into an isolated prefix and smoke-test them.")]
[IsDependentOn(typeof(PublishTask))]
public sealed class VerifyRegistryTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        if (context.DryRun)
        {
            context.Log.Information("Dry run: nothing was published, so the registry check is skipped.");
            return;
        }
        await context.Run("npm", "run", "test:registry", "--", context.RequireVersion());
    }
}

[TaskName("Release")]
[TaskDescription("Pack, publish, verify from the registry, then create the v<version> tag and GitHub Release.")]
[IsDependentOn(typeof(VerifyRegistryTask))]
public sealed class ReleaseTask : AsyncFrostingTask<BuildContext>
{
    public override async Task RunAsync(BuildContext context)
    {
        var manifest = context.ReadManifest();
        var tag = $"v{manifest.Version}";
        if (context.DryRun)
        {
            context.Log.Information("Dry run: would create GitHub Release {0} at {1}.", tag, manifest.Commit);
            return;
        }
        var remoteTag = await context.Read("git", "ls-remote", "--tags", "origin", $"refs/tags/{tag}");
        if (remoteTag.Length > 0 && !remoteTag.StartsWith(manifest.Commit, StringComparison.Ordinal))
            throw new CakeException($"Tag {tag} already exists on another commit.");
        if ((await context.Exec("gh", ["release", "view", tag], capture: true, check: false)).ExitCode == 0)
        {
            context.Log.Information("GitHub Release {0} already exists; skipped.", tag);
            return;
        }
        var notes = string.Join(Environment.NewLine, manifest.Packages.Select(package =>
            $"- `{package.Name}@{manifest.Version}` — shasum `{package.Shasum}` — https://www.npmjs.com/package/{package.Name}/v/{manifest.Version}"));
        await context.Exec("gh", [
            "release", "create", tag, "--target", manifest.Commit, "--title", tag, "--notes", notes,
            .. manifest.Packages.Select(package => Path.Combine(context.ReleaseDirectory, package.File)),
            context.ManifestPath,
        ]);
    }
}
