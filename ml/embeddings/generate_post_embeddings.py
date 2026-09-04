import os
import pymongo
from sentence_transformers import SentenceTransformer

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/L")

def generate_embeddings_for_all_posts():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = pymongo.MongoClient(MONGO_URI)
    db = client.get_database()
    posts_collection = db["posts"]

    posts = list(posts_collection.find({}))
    total_posts = len(posts)
    print(f"Found {total_posts} total posts in MongoDB collection 'posts'.")

    if total_posts == 0:
        print("No posts found to process.")
        return

    print("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    updated_count = 0

    for idx, post in enumerate(posts):
        caption = post.get("caption", "") or ""
        media_type = post.get("mediaType", "image")

        text_parts = []
        if caption.strip():
            text_parts.append(caption.strip())
        if media_type == "video":
            text_parts.append("video post")

        text = " ".join(text_parts).strip()
        if not text:
            text = "image post photo content"

        # Generate 384-dim normalized embedding
        embedding = model.encode(text, normalize_embeddings=True).tolist()

        posts_collection.update_one(
            {"_id": post["_id"]},
            {"$set": {"embedding": embedding}}
        )

        updated_count += 1
        if (idx + 1) % 10 == 0 or (idx + 1) == total_posts:
            print(f"Progress: [{idx + 1}/{total_posts}] posts updated with 384-dim embedding vector.")

    print(f"\nSUCCESS: Generated and saved 384-dimensional embeddings for all {updated_count} posts in MongoDB!")
    print("--------------------------------------------------------------------------------------\n")

if __name__ == "__main__":
    generate_embeddings_for_all_posts()
