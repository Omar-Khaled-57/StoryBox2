use anyhow::Result;
use rand::Rng;
use std::path::Path; // For simulated fallback embeddings

/// Our wrapper for the AI engine
#[derive(Default)]
pub struct AIEngine {
    _is_mock: bool, // Always true for now without ORT
}

pub struct ImageAnalysis {
    pub tags: Vec<String>,
    pub dominant_color: Option<String>,
    pub vibe: String,
    pub embedding: Vec<f32>,
}

impl AIEngine {
    /// Initialize the engine.
    pub fn new(app_data_dir: &Path) -> Result<Self> {
        let models_dir = app_data_dir.join("models");
        std::fs::create_dir_all(&models_dir).ok();

        // In a real app with ONNX/Candle, we would load native models here.
        // For now, we rely on Ollama or Mock simulation.
        Ok(Self { _is_mock: false })
    }

    /// Check if the AI provider is available and required models are loaded
    pub async fn check_availability(&self, provider: &str, base_url: &str, vision_model: &str, text_model: &str) -> Result<serde_json::Value> {
        if provider == "ollama" {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(2))
                .build()?;
            
            let res = client.get(format!("{}/api/tags", base_url)).send().await;
            
            match res {
                Ok(response) => {
                    let json: serde_json::Value = response.json().await?;
                    let models = json["models"].as_array();
                    
                    let mut has_vision = false;
                    let mut has_text = false;
                    
                    if let Some(model_list) = models {
                        for m in model_list {
                            if let Some(name) = m["name"].as_str() {
                                if name.contains(vision_model) { has_vision = true; }
                                if name.contains(text_model) { has_text = true; }
                            }
                        }
                    }
                    
                    return Ok(serde_json::json!({
                        "available": true,
                        "vision_model": vision_model,
                        "vision_model_loaded": has_vision,
                        "text_model": text_model,
                        "text_model_loaded": has_text,
                        "message": if has_vision && has_text { "All models ready" } else { "Some models missing" }
                    }));
                },
                Err(_) => {
                    return Ok(serde_json::json!({
                        "available": false,
                        "message": "Ollama is not running. Please start Ollama."
                    }));
                }
            }
        }

        Ok(serde_json::json!({ "available": true, "message": "Mock engine active" }))
    }

    /// Run inference on an image to extract features
    pub async fn analyze_image(
        &self, 
        image_path: &Path, 
        provider: &str, 
        base_url: &str, 
        model_name: &str
    ) -> Result<ImageAnalysis> {
        if provider == "ollama" {
            return self.analyze_image_ollama(image_path, base_url, model_name).await;
        }

        // Mock Fallback
        self.analyze_image_mock().await
    }

    async fn analyze_image_mock(&self) -> Result<ImageAnalysis> {
        // Simulate inference delay
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Generate some random simulated "AI" output
        let mut rng = rand::thread_rng();
        let potential_tags = vec![
            "sunset", "mountain", "forest", "city lights", "cozy interior", 
            "vintage", "modern architecture", "garden", "street food", "concert",
            "winter wonder", "family gathering", "workspace", "nature", "urban"
        ];
        let mut tags = Vec::new();
        let tag_count = rng.gen_range(2..5);
        for _ in 0..tag_count {
            let r = rng.gen_range(0..potential_tags.len());
            let t = potential_tags[r].to_string();
            if !tags.contains(&t) {
                tags.push(t);
            }
        }

        let vibes = vec!["nostalgic", "cinematic", "dreamy", "vibrant", "minimalist", "moody", "warm"];
        let vibe = vibes[rng.gen_range(0..vibes.len())].to_string();

        // 128-dimensional simulated embedding vector
        let mut embedding = vec![0.0f32; 128];
        for val in embedding.iter_mut() {
            *val = rng.gen_range(-1.0..1.0);
        }

        Ok(ImageAnalysis {
            tags,
            dominant_color: None, // Preserve calculated color
            vibe,
            embedding,
        })
    }

    async fn analyze_image_ollama(
    &self, 
    image_path: &Path, 
    base_url: &str, 
    model_name: &str
) -> Result<ImageAnalysis> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // Read and encode image
    let bytes = tokio::fs::read(image_path).await?;
    let base64_image = STANDARD.encode(bytes);

    let prompt = "Analyze this image. Provide exactly 5 descriptive, objective tags and one vibe word. \
                  Focus on clear elements (objects, atmosphere, lighting). \
                  Respond ONLY with this format: \
                  Tags: tag1, tag2, tag3, tag4, tag5 \
                  Vibe: vibe_word";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90)) // Increased timeout for slower local models
        .build()?;
        
    let res = client.post(format!("{}/api/generate", base_url))
        .json(&serde_json::json!({
            "model": model_name,
            "prompt": prompt,
            "images": [base64_image],
            "stream": false,
            "options": {
                "temperature": 0.1, // Lower temperature for more consistent formatting
                "top_p": 0.9
            }
        }))
        .send()
        .await?;

    let json: serde_json::Value = res.json().await?;
    let raw_response = json["response"].as_str().unwrap_or("").trim();
    
    // Log raw response for debugging if it's suspicious (commented out for production but ready for dev)
    // println!("AI Analysis Raw: {}", raw_response);

    // --- ROBUST PARSING ---
    let mut tags = Vec::new();
    let mut vibe = "memorable".to_string();

    let response_lower = raw_response.to_lowercase();
    
    // Try to find tags
    let tags_section = if let Some(tags_pos) = response_lower.find("tags:") {
        let after_tags = &response_lower[tags_pos + 5..];
        after_tags.split("vibe:").next().unwrap_or(after_tags)
    } else {
        // Fallback: if "Tags:" missing, just take first portion before "Vibe:" 
        response_lower.split("vibe:").next().unwrap_or(&response_lower)
    };

    // Split by common delimiters and clean
    for part in tags_section.split(|c: char| c == ',' || c == '.' || c == '\n' || c == ';') {
        let t = part.trim().trim_matches(|c: char| !c.is_alphanumeric() && c != ' ').to_string();
        if t.len() > 1 && !t.contains("tags") && !t.contains("vibe") {
            tags.push(t);
        }
    }

    // Try to find vibe
    if let Some(vibe_pos) = response_lower.find("vibe:") {
        let after_vibe = &response_lower[vibe_pos + 5..];
        vibe = after_vibe.trim()
            .split(|c: char| c == '.' || c == ',' || c == '\n' || c.is_whitespace())
            .next()
            .unwrap_or("memorable")
            .trim_matches(|c: char| !c.is_alphanumeric())
            .to_string();
    }

    // Final Junk Filtering
    tags.retain(|t| {
        !t.is_empty() &&
        !t.contains("(arabic)") && 
        !t.chars().all(|c| c.is_numeric() || c == '.' || c == ',') &&
        t.len() > 2 &&
        !t.contains("here are") && // Filter out conversational filler
        !t.contains("i see")
    });

    if tags.is_empty() {
        tags = vec!["visual".into(), "memory".into(), "moment".into()];
    }
    if tags.len() > 7 {
        tags.truncate(7);
    }

    let embedding = vec![0.0f32; 128];

    Ok(ImageAnalysis {
        tags,
        dominant_color: None, // Preserve calculated color
        vibe,
        embedding,
    })
}

}

/// A client for local AI text generation (Ollama)
pub struct Storyteller {
    pub provider: String,
    pub base_url: String,
    pub model_name: String,
}

impl Storyteller {
    pub fn new(provider: String, base_url: String, model_name: String) -> Self {
        Self { provider, base_url, model_name }
    }

    pub async fn generate_caption(&self, tags: &[String], vibe: Option<&str>, color_vibe: Option<&str>) -> Option<String> {
        if self.provider == "mock" {
            return None; // Let stories.rs handle its own templates
        }

        if self.provider == "ollama" {
            let color_hint = color_vibe.map(|c| format!(" and a '{}' aesthetic", c)).unwrap_or_default();
            let prompt = format!(
                "Write a unique, poetic 3-5 word title for a photo story with these themes: {}. The vibe is {}{}. Do NOT mention 'beach' unless it's in the themes. Make it sound professional and evocative. Respond ONLY with the title text.",
                tags.join(", "),
                vibe.unwrap_or("memorable"),
                color_hint
            );

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .ok()?;
            let res = client.post(format!("{}/api/generate", self.base_url))
                .json(&serde_json::json!({
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": false,
                    "options": {
                        "temperature": 0.7, // Slightly lower for more poetic but stable titles
                        "top_p": 0.9
                    }
                }))
                .send()
                .await
                .ok()?;

            let json: serde_json::Value = res.json().await.ok()?;
            return json["response"].as_str().map(|s| s.trim().trim_matches('"').to_string());
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[tokio::test]
    async fn test_ai_engine_mock() {
        let engine = AIEngine::default();
        let res = engine.analyze_image_mock().await.unwrap();
        assert!(!res.tags.is_empty());
        assert!(!res.vibe.is_empty());
    }

    #[tokio::test]
    #[ignore] // Run with `cargo test -- --ignored` or specifically by name
    async fn test_ollama_generate_caption() {
        let storyteller = Storyteller::new(
            "ollama".to_string(), 
            "http://localhost:11434".to_string(), 
            "llama3:latest".to_string()
        );
        let tags = vec!["nature".to_string(), "mountain".to_string(), "sunset".to_string()];
        let vibe = Some("peaceful");
        
        let caption = storyteller.generate_caption(&tags, vibe, None).await;
        
        println!("Generated Caption: {:?}", caption);
        assert!(caption.is_some());
        let cap = caption.unwrap();
        assert!(!cap.is_empty());
    }
    
    #[tokio::test]
    #[ignore]
    async fn test_ollama_analyze_image() {
        let engine = AIEngine::default();
        let path = PathBuf::from("icons/StoreLogo.png");
        
        if path.exists() {
            let res = engine.analyze_image_ollama(
                &path, 
                "http://localhost:11434", 
                "moondream:latest"
            ).await;
            
            match res {
                Ok(analysis) => {
                    println!("Tags: {:?}", analysis.tags);
                    println!("Vibe: {}", analysis.vibe);
                    assert!(!analysis.tags.is_empty());
                },
                Err(e) => panic!("Analysis failed: {}", e),
            }
        } else {
            println!("Test image not found, skipping...");
        }
    }
}
