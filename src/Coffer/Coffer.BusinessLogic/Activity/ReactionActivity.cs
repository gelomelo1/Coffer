namespace Coffer.BusinessLogic.Activity
{
    /// <summary>
    /// A like and a rarity rating share one row, so one request can mean several things. Comparing the row before and
    /// after tells what the user actually did: liked / removed the like, rated / changed / removed the rating.
    /// </summary>
    public static class ReactionActivity
    {
        public static IEnumerable<(string Kind, object? Details)> Changes(bool oldLiked, int? oldRarity, bool newLiked, int? newRarity)
        {
            if (!oldLiked && newLiked) yield return ("reaction.liked", null);
            if (oldLiked && !newLiked) yield return ("reaction.unliked", null);

            if (oldRarity == null && newRarity != null) yield return ("reaction.rated", new { to = newRarity });
            else if (oldRarity != null && newRarity == null) yield return ("reaction.unrated", new { from = oldRarity });
            else if (oldRarity != null && newRarity != null && oldRarity != newRarity) yield return ("reaction.rerated", new { from = oldRarity, to = newRarity });
        }
    }
}
