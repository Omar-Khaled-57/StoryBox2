use lru::LruCache;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use std::num::NonZeroUsize;
use std::sync::Mutex;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CachedImage {
    pub id: String,
    pub path: String,
    pub date_taken: Option<String>,
    pub ai_analyzed: bool,
    pub tags: Option<Vec<String>>,
    pub vibe: Option<String>,
    pub dominant_color: Option<String>,
}

pub struct ImageCache {
    cache: Mutex<LruCache<String, CachedImage>>,
}

impl ImageCache {
    pub fn new(capacity: usize) -> Self {
        let cap = NonZeroUsize::new(capacity.max(1)).unwrap_or(NonZeroUsize::new(100).unwrap());
        Self {
            cache: Mutex::new(LruCache::new(cap)),
        }
    }

    pub fn get(&self, id: &str) -> Option<CachedImage> {
        self.cache.lock().ok().and_then(|mut c| c.get(id).cloned())
    }

    pub fn insert(&self, id: String, image: CachedImage) {
        if let Ok(mut c) = self.cache.lock() {
            c.put(id, image);
        }
    }

    pub fn remove(&self, id: &str) {
        if let Ok(mut c) = self.cache.lock() {
            c.pop(id);
        }
    }

    pub fn contains(&self, id: &str) -> bool {
        self.cache.lock().ok().map_or(false, |mut c| c.contains(id))
    }

    pub fn update_analysis(&self, id: &str, tags: Option<Vec<String>>, vibe: Option<String>) {
        if let Ok(mut c) = self.cache.lock() {
            if let Some(entry) = c.get_mut(id) {
                entry.tags = tags;
                entry.vibe = vibe;
                entry.ai_analyzed = true;
            }
        }
    }

    pub fn load_from_db(&self, pool: &Pool<Sqlite>, capacity: usize) {
        let cap = capacity.max(1);
        let rows: Vec<(String, String, Option<String>, bool, Option<String>, Option<String>, Option<String>)> =
            sqlx::query_as(
                "SELECT i.id, i.path, i.date_taken, i.ai_analyzed, f.tags, f.vibe, f.dominant_color
                 FROM images i LEFT JOIN image_features f ON i.id = f.image_id
                 ORDER BY i.date_taken DESC"
            )
            .fetch_all(pool)
            .blocking_recv()
            .unwrap_or_default();

        if let Ok(mut c) = self.cache.lock() {
            c.clear();
            for row in rows.into_iter().take(cap) {
                let tags: Option<Vec<String>> = row.4
                    .as_deref()
                    .and_then(|j| serde_json::from_str(j).ok());
                c.put(row.0.clone(), CachedImage {
                    id: row.0,
                    path: row.1,
                    date_taken: row.2,
                    ai_analyzed: row.3,
                    tags,
                    vibe: row.5,
                    dominant_color: row.6,
                });
            }
        }
    }

    pub fn get_random_analyzed(&self, count: usize) -> Vec<CachedImage> {
        use rand::seq::SliceRandom;
        self.cache.lock().ok().map_or_else(Vec::new, |c| {
            let analyzed: Vec<CachedImage> = c.iter()
                .filter(|(_, img)| img.ai_analyzed)
                .map(|(_, img)| img.clone())
                .collect();
            analyzed.choose_multiple(&mut rand::thread_rng(), count).cloned().collect()
        })
    }
}
