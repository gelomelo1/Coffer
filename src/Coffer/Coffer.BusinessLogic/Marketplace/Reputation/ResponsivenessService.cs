using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Reputation
{
    public record ResponsivenessStats(double? ResponseRate, int? TypicalResponseMinutes, int ConversationsReceived);

    /// <summary>
    /// Passive communication metric for subject owners: share of inquiries answered within 48 hours and the
    /// median time to the first answer, over the last 90 days. Never a star rating.
    /// </summary>
    public class ResponsivenessService
    {
        public static readonly TimeSpan Window = TimeSpan.FromDays(90);
        public static readonly TimeSpan AnswerDeadline = TimeSpan.FromHours(48);

        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public ResponsivenessService(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<ResponsivenessStats> GetAsync(Guid userId)
        {
            var since = _clock.UtcNow - Window;
            var rows = await _db.Conversations.AsNoTracking()
                .Where(c => c.CreatedAt >= since
                    && c.Participants.Any(p => p.UserId == userId && p.Role == ParticipantRole.Owner))
                .Select(c => new
                {
                    c.OwnerFirstResponseAt,
                    FirstInquiry = c.Messages
                        .Where(m => m.SenderId != null && m.SenderId != userId)
                        .OrderBy(m => m.CreatedAt)
                        .Select(m => (DateTime?)m.CreatedAt)
                        .FirstOrDefault(),
                })
                .ToListAsync();

            var received = rows.Where(r => r.FirstInquiry != null).ToList();
            if (received.Count == 0) return new ResponsivenessStats(null, null, 0);

            var delays = received
                .Where(r => r.OwnerFirstResponseAt != null)
                .Select(r => r.OwnerFirstResponseAt!.Value - r.FirstInquiry!.Value)
                .Select(d => d < TimeSpan.Zero ? TimeSpan.Zero : d)
                .ToList();

            var answeredInTime = delays.Count(d => d <= AnswerDeadline);
            int? median = delays.Count == 0 ? null : (int)Math.Round(Median(delays.Select(d => d.TotalMinutes).ToList()));
            return new ResponsivenessStats(Math.Round((double)answeredInTime / received.Count, 2), median, received.Count);
        }

        private static double Median(List<double> values)
        {
            values.Sort();
            var mid = values.Count / 2;
            return values.Count % 2 == 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
        }
    }
}
