namespace Coffer.Domain.Entities
{
    /// <summary>
    /// A cap the AI found on an uploaded photo that its owner hasn't decided about yet: it waits on the collection's
    /// "waiting for review" list until it is added (new item or more of an existing one) or skipped and deleted.
    /// Its crop and fingerprint live as {Id}.jpg / {Id}.npy in IMAGESTORE_PATH/pending.
    /// </summary>
    public class PendingItem
    {
        /// <summary>The detection id the AI service gave the crop (also its file name).</summary>
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid CollectionId { get; set; }
        /// <summary>How many of this cap were on the photo.</summary>
        public int Quantity { get; set; }
        /// <summary>File name of the crop in the pending folder.</summary>
        public string Image { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }
}
