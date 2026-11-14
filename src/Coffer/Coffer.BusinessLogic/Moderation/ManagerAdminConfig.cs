using System.Text.Json;

namespace Coffer.BusinessLogic.Moderation
{
    /// <summary>
    /// Who may use Coffer.Manager: GitHub accounts whose immutable numeric id is listed in
    /// COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS (a JSON array, e.g. '["12345678","87654321"]').
    /// Usernames and e-mails are never used for authorization. An empty or invalid list grants nobody.
    /// </summary>
    public sealed class ManagerAdminConfig
    {
        public const string EnvName = "COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS";
        public const string ProvisioningRequiredCode = "admin_provisioning_required";

        private readonly HashSet<string> _ids;

        public ManagerAdminConfig(IEnumerable<string> ids, string? problem = null)
        {
            _ids = new HashSet<string>(ids, StringComparer.Ordinal);
            Problem = problem;
        }

        public IReadOnlyCollection<string> Ids => _ids;

        /// <summary>Why the configuration grants nobody (null when at least one admin is configured).</summary>
        public string? Problem { get; }

        public bool HasAdmins => _ids.Count > 0;

        public bool IsAdmin(string? githubId) => githubId != null && _ids.Contains(githubId);

        public static ManagerAdminConfig FromEnvironment() => Parse(Environment.GetEnvironmentVariable(EnvName));

        /// <summary>Parses the JSON array. Accepts strings or numbers; anything else makes the whole value invalid.</summary>
        public static ManagerAdminConfig Parse(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return new ManagerAdminConfig(Array.Empty<string>(),
                    $"No Coffer.Manager administrators are configured. Set {EnvName} to a JSON array of GitHub user ids, e.g. '[\"12345678\"]'.");

            var text = raw.Trim();
            // Tolerate a value that still carries its single quotes from an env file.
            if (text.Length >= 2 && text[0] == '\'' && text[^1] == '\'')
                text = text[1..^1];

            try
            {
                using var doc = JsonDocument.Parse(text);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                    return Invalid("it must be a JSON array");

                var ids = new List<string>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var id = el.ValueKind switch
                    {
                        JsonValueKind.String => el.GetString()?.Trim(),
                        JsonValueKind.Number => el.GetRawText(),
                        _ => null,
                    };
                    if (string.IsNullOrEmpty(id) || !id.All(char.IsAsciiDigit))
                        return Invalid($"'{el.GetRawText()}' is not a numeric GitHub user id (usernames are not accepted)");
                    ids.Add(id);
                }

                return ids.Count == 0
                    ? new ManagerAdminConfig(ids, $"{EnvName} is an empty list, so nobody can sign in to Coffer.Manager.")
                    : new ManagerAdminConfig(ids);
            }
            catch (JsonException)
            {
                return Invalid("it is not valid JSON");
            }
        }

        private static ManagerAdminConfig Invalid(string why) =>
            new(Array.Empty<string>(), $"{EnvName} is invalid ({why}); nobody can sign in to Coffer.Manager until it is fixed.");
    }
}
