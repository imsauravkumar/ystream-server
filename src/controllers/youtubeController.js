import axios from "axios";

export async function searchYoutube(req, res, next) {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ message: "Search query is required." });
    }
    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({ message: "YOUTUBE_API_KEY is not configured." });
    }

    const { data } = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 12,
        safeSearch: "moderate",
        videoEmbeddable: true
      }
    });

    const items = data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
    }));

    res.json({ items });
  } catch (error) {
    next(Object.assign(new Error("YouTube search failed."), { statusCode: 502, cause: error }));
  }
}
