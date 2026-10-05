using FieldOps.Application.Common;
using FieldOps.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace FieldOps.Infrastructure.Storage;

public class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    public string RootPath { get; set; } = "uploads";
    public long MaxBytes { get; set; } = 5 * 1024 * 1024;
}

/// <summary>Stores uploads on local disk below a configured root, with strict validation of size, MIME type, extension and magic bytes.</summary>
public class LocalFileStorage(IOptions<FileStorageOptions> options) : IFileStorage
{
    private static readonly Dictionary<string, string[]> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = [".jpg", ".jpeg"],
        ["image/png"] = [".png"],
        ["image/webp"] = [".webp"],
        ["image/gif"] = [".gif"]
    };

    private readonly FileStorageOptions _options = options.Value;

    private string Root => Path.GetFullPath(_options.RootPath);

    public async Task<StoredFile> SaveAsync(
        Guid companyId, Guid jobId, string originalFileName, string contentType, long length, Stream content,
        CancellationToken ct = default)
    {
        var max = _options.MaxBytes;

        if (length <= 0)
            throw new ValidationException("file", "The uploaded file is empty.");
        if (length > max)
            throw new ValidationException("file", $"File is too large. The maximum size is {max / (1024 * 1024.0):0.#} MB.");

        var declaredType = (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        if (!AllowedTypes.TryGetValue(declaredType, out var allowedExtensions))
            throw new ValidationException("file", "Unsupported file type. Allowed types: JPEG, PNG, WebP, GIF.");

        var extension = Path.GetExtension(originalFileName ?? string.Empty).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
            throw new ValidationException("file", $"File extension '{extension}' does not match the declared content type.");

        var header = new byte[12];
        var read = 0;
        while (read < header.Length)
        {
            var n = await content.ReadAsync(header.AsMemory(read, header.Length - read), ct);
            if (n == 0) break;
            read += n;
        }

        if (!HasValidSignature(declaredType, header.AsSpan(0, read)))
            throw new ValidationException("file", "The file content does not match an allowed image format.");

        var storedName = $"{Guid.NewGuid():N}{extension}";
        var relativePath = Path.Combine(companyId.ToString("N"), jobId.ToString("N"), storedName).Replace('\\', '/');
        var fullPath = Resolve(relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        long total = read;
        try
        {
            await using var target = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
            await target.WriteAsync(header.AsMemory(0, read), ct);

            var buffer = new byte[81920];
            int count;
            while ((count = await content.ReadAsync(buffer, ct)) > 0)
            {
                total += count;
                if (total > max)
                    throw new ValidationException("file", $"File is too large. The maximum size is {max / (1024 * 1024.0):0.#} MB.");
                await target.WriteAsync(buffer.AsMemory(0, count), ct);
            }
        }
        catch
        {
            if (File.Exists(fullPath)) File.Delete(fullPath);
            throw;
        }

        return new StoredFile(storedName, relativePath, declaredType, total);
    }

    public Task<Stream> OpenReadAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = Resolve(relativePath);
        if (!File.Exists(fullPath))
            throw new NotFoundException("The stored file could not be found.");

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string relativePath, CancellationToken ct = default)
    {
        var fullPath = Resolve(relativePath);
        if (File.Exists(fullPath)) File.Delete(fullPath);
        return Task.CompletedTask;
    }

    /// <summary>Resolves a relative path under the root and refuses anything that escapes it.</summary>
    private string Resolve(string relativePath)
    {
        var root = Root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(Path.Combine(root, relativePath));
        if (!full.StartsWith(root, StringComparison.Ordinal))
            throw new ForbiddenException("Invalid file path.");
        return full;
    }

    private static bool HasValidSignature(string contentType, ReadOnlySpan<byte> h) => contentType switch
    {
        "image/jpeg" => h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF,
        "image/png" => h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47
                       && h[4] == 0x0D && h[5] == 0x0A && h[6] == 0x1A && h[7] == 0x0A,
        "image/gif" => h.Length >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8',
        "image/webp" => h.Length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                        && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P',
        _ => false
    };
}
