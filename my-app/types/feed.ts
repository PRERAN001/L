export interface FeedUser {
  _id: string;
  username: string;
  name?: string;
  profileImage?: string;
}

export interface FeedComment {
  _id: string;
  user: FeedUser;
  text: string;
  createdAt: string;
}

export interface RawFeedPost {
  _id: string;
  user: FeedUser;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  likesCount: number;
  isLiked: boolean;
  commentsCount: number;
  comments: FeedComment[];
  createdAt: string;
}

export interface FeedResponse {
  posts: RawFeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FeedQueryParams {
  cursor?: string;
  limit?: number;
}
