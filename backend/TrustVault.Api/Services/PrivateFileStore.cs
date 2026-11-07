namespace TrustVault.Api.Services;

public sealed class PrivateFileStore
{
    private readonly string _root;
    public PrivateFileStore(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
    }
    public async Task<string> SaveAsync(Guid id, Stream input)
    {
        var key = id.ToString("N");
        var path = Resolve(key);
        await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await input.CopyToAsync(output);
        return path;
    }
    public Stream Open(string key) => File.OpenRead(Resolve(key));
    public void Delete(string key) { var p = Resolve(key); if (File.Exists(p)) File.Delete(p); }
    private string Resolve(string key)
    {
        if (key.Length != 32 || !key.All(Uri.IsHexDigit)) throw new InvalidOperationException("Invalid storage key.");
        var path = Path.GetFullPath(Path.Combine(_root, key));
        if (!path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid storage path.");
        return path;
    }
}
