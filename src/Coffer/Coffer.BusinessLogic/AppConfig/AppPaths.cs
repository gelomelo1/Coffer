using DotNetEnv;

namespace Coffer.BusinessLogic.AppConfig
{
    /// <summary>
    /// Every data folder lives under one root, COFFER_ROOT_PATH (in Docker: /app). The Python service derives the same
    /// folders the same way (Coffer.PythonService/paths.py), so the two always agree.
    /// </summary>
    public static class AppPaths
    {
        public const string RootVariable = "COFFER_ROOT_PATH";

        public static string Root
        {
            get
            {
                var root = Env.GetString(RootVariable);
                if (string.IsNullOrWhiteSpace(root))
                    throw new InvalidOperationException($"{RootVariable} environmental variable is not set");
                return root;
            }
        }

        /// <summary>Item, collection cover, listing, news and pending images.</summary>
        public static string Images => Path.Combine(Root, "data", "images");

        /// <summary>Item type icons uploaded from Coffer.Manager.</summary>
        public static string Icons => Path.Combine(Root, "data", "icons");

        /// <summary>The AI service's vector store.</summary>
        public static string Vectors => Path.Combine(Root, "data", "vectors");

        /// <summary>Crops and fingerprints the AI service writes while a photo is checked (kept 10 minutes).</summary>
        public static string Temp => Path.Combine(Root, "data", "temp");

        /// <summary>AI models per item type.</summary>
        public static string Models => Path.Combine(Root, "models");
    }
}
