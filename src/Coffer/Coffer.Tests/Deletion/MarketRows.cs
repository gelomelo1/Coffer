using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Deletion
{
    /// <summary>Inserts marketplace and comment rows directly, for tests of what deletions do to them.</summary>
    public sealed class MarketRows
    {
        private readonly TestDb _db;

        public MarketRows(TestDb db) => _db = db;

        private int CityId()
        {
            var city = _db.Context.Cities.FirstOrDefault();
            if (city == null)
            {
                city = new City { ExternalId = 3054643, Name = "Budapest", CountryCode = "HU", Latitude = 47.49801, Longitude = 19.03991 };
                _db.Context.Cities.Add(city);
                _db.Context.SaveChanges();
            }
            return city.Id;
        }

        private int CollectionTypeId()
        {
            var type = _db.Context.CollectionTypes.FirstOrDefault();
            if (type == null)
            {
                type = new CollectionTypeProvided("Coins", "desc", "#a98d3c", "coin") { Published = true };
                _db.Context.CollectionTypes.Add(type);
                _db.Context.SaveChanges();
            }
            return type.Id;
        }

        public Listing Listing(User owner, ListingStatus status = ListingStatus.Active, string title = "Silver coins")
        {
            var now = DateTime.UtcNow;
            var listing = new Listing
            {
                OwnerId = owner.Id, Kind = ListingKind.Sell, CollectionTypeId = CollectionTypeId(), Title = title, Description = "Two coins",
                PriceCents = 1000, Condition = ListingCondition.Good, CityId = CityId(), AllowsLocalPickup = true, AllowsShipping = true,
                Status = status, CreatedAt = now, UpdatedAt = now,
            };
            listing.Lines.Add(new ListingLine { Name = "Silver coin", Quantity = 2, Position = 0 });
            listing.Images.Add(new ListingImage { FileName = $"{Guid.NewGuid()}_1.jpg", Position = 0 });
            _db.Context.Listings.Add(listing);
            _db.Context.SaveChanges();
            return listing;
        }

        public Conversation Chat(Listing listing, User inquirer)
        {
            var now = DateTime.UtcNow;
            var conversation = new Conversation { Id = Guid.NewGuid(), SubjectType = "listing", SubjectId = listing.Id, CreatedAt = now, LastMessageAt = now };
            conversation.Participants.Add(new ConversationParticipant { UserId = listing.OwnerId, Role = ParticipantRole.Owner, JoinedAt = now });
            conversation.Participants.Add(new ConversationParticipant { UserId = inquirer.Id, Role = ParticipantRole.Inquirer, JoinedAt = now });
            _db.Context.Conversations.Add(conversation);
            _db.Context.SaveChanges();
            return conversation;
        }

        public Message Say(Conversation conversation, User sender, string body)
        {
            var message = new Message { Id = Guid.NewGuid(), ConversationId = conversation.Id, SenderId = sender.Id, Kind = MessageKind.Text, Body = body, CreatedAt = DateTime.UtcNow };
            _db.Context.Messages.Add(message);
            _db.Context.SaveChanges();
            return message;
        }

        /// <summary>A deal on <paramref name="listing"/> between its owner (seller) and <paramref name="buyer"/>.</summary>
        public Deal Deal(Listing listing, User buyer, DealStatus status, DateTime? shippedAt = null)
        {
            var conversation = Chat(listing, buyer);
            var now = DateTime.UtcNow;
            var deal = new Deal
            {
                Id = Guid.NewGuid(), ListingId = listing.Id, ConversationId = conversation.Id, SellerId = listing.OwnerId, BuyerId = buyer.Id,
                Method = shippedAt != null ? DeliveryMethod.Shipping : DeliveryMethod.LocalPickup, Status = status, AgreedPriceCents = 1000,
                ShippedAt = shippedAt, CreatedAt = now, UpdatedAt = now,
                CompletedAt = status == DealStatus.Completed ? now : null,
                ReviewDeadline = status is DealStatus.Completed or DealStatus.Disputed ? now.AddDays(14) : null,
                DisputeReason = status == DealStatus.Disputed ? "The parcel arrived empty, nothing inside." : null,
            };
            _db.Context.Deals.Add(deal);
            _db.Context.SaveChanges();
            return deal;
        }

        public Review Review(Deal deal, User reviewer, User reviewee, int stars = 5)
        {
            var review = new Review
            {
                Id = Guid.NewGuid(), DealId = deal.Id, ReviewerId = reviewer.Id, RevieweeId = reviewee.Id,
                ReviewerRole = reviewer.Id == deal.BuyerId ? ReviewerRole.Buyer : ReviewerRole.Seller, Stars = stars,
                Comment = "Smooth deal.", CreatedAt = DateTime.UtcNow, PublishedAt = DateTime.UtcNow,
            };
            _db.Context.Reviews.Add(review);
            _db.Context.SaveChanges();
            return review;
        }

        public ItemComment Comment(ItemProvided item, User author, string body, ItemComment? parent = null, User? mention = null)
        {
            var comment = new ItemComment { Id = Guid.NewGuid(), ItemId = item.Id, AuthorId = author.Id, Body = body, CreatedAt = DateTime.UtcNow, ParentId = parent?.Id };
            comment.RootId = parent?.RootId ?? comment.Id;
            if (mention != null) comment.Mentions.Add(new ItemCommentMention { CommentId = comment.Id, UserId = mention.Id });
            _db.Context.ItemComments.Add(comment);
            _db.Context.SaveChanges();
            return comment;
        }
    }
}
