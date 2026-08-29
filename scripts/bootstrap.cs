using System.Diagnostics;

var root = FindRepositoryRoot(Environment.CurrentDirectory);
Environment.CurrentDirectory = root;

var submodulesOnly = args.Contains("--submodules-only", StringComparer.Ordinal);
var skipInstall = args.Contains("--skip-install", StringComparer.Ordinal);
var knownArguments = new HashSet<string>(StringComparer.Ordinal)
{
    "--submodules-only",
    "--skip-install",
};
var unknown = args.Where(argument => !knownArguments.Contains(argument)).ToArray();
if (unknown.Length > 0)
{
    throw new ArgumentException($"Unknown argument(s): {string.Join(", ", unknown)}");
}

var git = ResolveGit();
Run(git, "submodule", "sync", "--recursive");
Run(git, "submodule", "update", "--init", "--recursive");

if (!submodulesOnly && !skipInstall)
{
    var npmCommand = OperatingSystem.IsWindows() ? "npm.cmd" : "npm";
    Run(npmCommand, File.Exists(Path.Combine(root, "package-lock.json")) ? "ci" : "install");
}

Console.WriteLine("AI CLI Factory workspace is ready.");

static string FindRepositoryRoot(string start)
{
    var current = new DirectoryInfo(start);
    while (current is not null)
    {
        if (File.Exists(Path.Combine(current.FullName, "package.json")))
        {
            return current.FullName;
        }
        current = current.Parent;
    }
    throw new DirectoryNotFoundException("Run the bootstrap from inside the AI CLI Factory checkout.");
}

static string ResolveGit()
{
    if (OperatingSystem.IsWindows())
    {
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var gitForWindows = Path.Combine(programFiles, "Git", "cmd", "git.exe");
        if (File.Exists(gitForWindows))
        {
            return gitForWindows;
        }
    }
    return "git";
}

static void Run(string executable, params string[] arguments)
{
    Console.WriteLine($"> {Path.GetFileName(executable)} {string.Join(" ", arguments)}");
    var startInfo = new ProcessStartInfo(executable)
    {
        UseShellExecute = false,
    };
    foreach (var argument in arguments)
    {
        startInfo.ArgumentList.Add(argument);
    }
    using var process = Process.Start(startInfo)
        ?? throw new InvalidOperationException($"Could not start '{executable}'.");
    process.WaitForExit();
    if (process.ExitCode != 0)
    {
        throw new InvalidOperationException($"'{executable}' exited with code {process.ExitCode}.");
    }
}
