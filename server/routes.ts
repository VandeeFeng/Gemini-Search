import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  GoogleGenerativeAI,
  type ChatSession,
  type GenerateContentResult,
} from "@google/generative-ai";
import { marked } from "marked";
import { setupEnvironment } from "./env";

const env = setupEnvironment();
const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    temperature: 0.9,
    topP: 1,
    topK: 1,
    maxOutputTokens: 2048,
  },
});

// Store chat sessions in memory
const chatSessions = new Map<string, ChatSession>();

// Format raw text into proper markdown
async function formatResponseToMarkdown(
  text: string | Promise<string>,
  sources: Array<{ title: string; url: string; snippet: string; index: number }>
): Promise<string> {
  // Ensure we have a string to work with
  const resolvedText = await Promise.resolve(text);

  // First, ensure consistent newlines
  let processedText = resolvedText.replace(/\r\n/g, "\n");

  // Process main sections (lines that start with word(s) followed by colon)
  processedText = processedText.replace(
    /^([A-Za-z][A-Za-z\s]+):(\s*)/gm,
    "## $1$2"
  );

  // Process sub-sections (any remaining word(s) followed by colon within text)
  processedText = processedText.replace(
    /(?<=\n|^)([A-Za-z][A-Za-z\s]+):(?!\d)/gm,
    "### $1"
  );

  // Process bullet points
  processedText = processedText.replace(/^[•●○]\s*/gm, "* ");

  // Process code blocks
  processedText = processedText.replace(
    /```(\w+)?\n([\s\S]+?)```/g,
    (match, lang, code) => {
      return `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
    }
  );

  // Process inline code
  processedText = processedText.replace(
    /`([^`]+)`/g,
    '<code>$1</code>'
  );

  // Process references in square brackets [1], [2], etc.
  processedText = processedText.replace(
    /\[(\d+)\]/g,
    (match, num) => {
      const source = sources[parseInt(num) - 1];
      if (source) {
        return `<span class="reference-container">
          <a href="${source.url}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="reference-link">[${num}]</a>
          <div class="reference-tooltip">
            <div class="reference-title">${source.title}</div>
            <div class="reference-snippet">${source.snippet}</div>
            <div class="reference-url">${source.url}</div>
          </div>
        </span>`;
      }
      return match;
    }
  );

  // Split into paragraphs and process
  const paragraphs = processedText.split("\n\n").filter(Boolean);

  // Process each paragraph
  const formatted = paragraphs
    .map((p) => {
      // If it's a header, list item, HTML block, or contains a reference, preserve it
      if (p.startsWith("#") || 
          p.startsWith("*") || 
          p.startsWith("-") || 
          p.startsWith("<") ||
          p.includes('class="reference-container"')) {
        return p;
      }
      // Add proper paragraph formatting
      return `<p>${p}</p>`;
    })
    .join("\n\n");

  // Configure marked options
  marked.setOptions({
    gfm: true,
    breaks: true,
    silent: true
  });

  // Convert markdown to HTML using marked
  const html = marked.parse(formatted);
  
  // Add custom styles for references
  return `
    <style>
      .reference-container {
        display: inline-flex;
        position: relative;
        font-size: 0.85em;
        margin: 0 2px;
        vertical-align: super;
        z-index: 10;
      }
      .reference-link {
        color: #0366d6;
        text-decoration: none;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(3, 102, 214, 0.08);
        transition: all 0.2s ease;
        font-weight: 500;
        white-space: nowrap;
      }
      .reference-link:hover {
        background: rgba(3, 102, 214, 0.15);
      }
      .reference-tooltip {
        visibility: hidden;
        position: absolute;
        left: 50%;
        bottom: 100%;
        transform: translateX(-50%) translateY(-8px);
        background: #ffffff;
        border: 1px solid #e1e4e8;
        border-radius: 8px;
        padding: 16px;
        width: 320px;
        height: fit-content;
        max-height: none;
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        z-index: 1000;
        margin-bottom: 8px;
        opacity: 0;
        transition: all 0.2s ease;
        pointer-events: none;
      }
      .reference-container:hover .reference-tooltip {
        visibility: visible;
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }
      .reference-title {
        font-weight: 600;
        margin-bottom: 10px;
        font-size: 14px;
        color: #24292e;
        line-height: 1.4;
      }
      .reference-snippet {
        font-size: 13px;
        color: #586069;
        margin-bottom: 10px;
        line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      .reference-url {
        font-size: 12px;
        color: #0366d6;
        word-break: break-all;
        padding-top: 8px;
        border-top: 1px solid #eaecef;
      }
      .reference-tooltip::before,
      .reference-tooltip::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -8px;
        transform: translateX(-50%);
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        pointer-events: none;
      }
      .reference-tooltip::before {
        border-top: 8px solid #e1e4e8;
        bottom: -8px;
      }
      .reference-tooltip::after {
        border-top: 7px solid #ffffff;
        bottom: -7px;
      }
      @media (max-width: 640px) {
        .reference-tooltip {
          width: 280px;
          left: auto;
          right: 0;
          transform: translateY(-8px);
        }
        .reference-container:hover .reference-tooltip {
          transform: translateY(0);
        }
        .reference-tooltip::before,
        .reference-tooltip::after {
          left: auto;
          right: 16px;
        }
      }
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .reference-link {
          color: #58a6ff;
          background: rgba(88, 166, 255, 0.1);
        }
        .reference-link:hover {
          background: rgba(88, 166, 255, 0.2);
        }
        .reference-tooltip {
          background: #0d1117;
          border-color: #30363d;
        }
        .reference-title {
          color: #c9d1d9;
        }
        .reference-snippet {
          color: #8b949e;
        }
        .reference-url {
          color: #58a6ff;
          border-top-color: #30363d;
        }
        .reference-tooltip::before {
          border-top-color: #30363d;
        }
        .reference-tooltip::after {
          border-top-color: #0d1117;
        }
      }
    </style>
    ${html}
  `;
}

interface WebSource {
  uri: string;
  title: string;
}

interface GroundingChunk {
  web?: WebSource;
}

interface TextSegment {
  startIndex: number;
  endIndex: number;
  text: string;
}

interface GroundingSupport {
  segment: TextSegment;
  groundingChunkIndices: number[];
  confidenceScores: number[];
}

interface GroundingMetadata {
  groundingChunks: GroundingChunk[];
  groundingSupports: GroundingSupport[];
  searchEntryPoint?: any;
  webSearchQueries?: string[];
}

export function registerRoutes(app: Express): Server {
  // Search endpoint - creates a new chat session
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query) {
        return res.status(400).json({
          message: "Query parameter 'q' is required",
        });
      }

      // Create a new chat session with search capability
      const chat = model.startChat({
        tools: [
          {
            // @ts-ignore - google_search is a valid tool but not typed in the SDK yet
            google_search: {},
          },
        ],
      });

      // Generate content with search tool
      const result = await chat.sendMessage(`${query}

Please include numbered references to your sources in square brackets [1], [2], etc. at the end of relevant statements.`);
      const response = await result.response;
      console.log(
        "Raw Google API Response:",
        JSON.stringify(
          {
            text: response.text(),
            candidates: response.candidates,
            groundingMetadata: response.candidates?.[0]?.groundingMetadata,
            parts: response.candidates?.[0]?.content?.parts,
          },
          null,
          2
        )
      );
      let text = response.text();

      // Extract sources from grounding metadata
      const sourceMap = new Map<
        string,
        { title: string; url: string; snippet: string; index: number }
      >();

      // Get grounding metadata from response
      const metadata = response.candidates?.[0]?.groundingMetadata as any;
      console.log('Extracted metadata:', JSON.stringify(metadata, null, 2));
      
      if (metadata) {
        const chunks = metadata.groundingChunks || [];
        const supports = metadata.groundingSupports || [];
        
        console.log('Processing chunks:', chunks.length);
        console.log('Processing supports:', supports.length);

        // First pass: collect all sources
        chunks.forEach((chunk: any, index: number) => {
          if (chunk.web?.uri && chunk.web?.title) {
            const url = chunk.web.uri;
            if (!sourceMap.has(url)) {
              // Find snippets that reference this chunk
              const snippets = supports
                .filter((support: any) =>
                  support.groundingChunkIndices.includes(index)
                )
                .map((support: any) => support.segment.text)
                .join(" ");

              sourceMap.set(url, {
                title: chunk.web.title,
                url: url,
                snippet: snippets || "",
                index: sourceMap.size + 1 // Add 1-based index
              });
              
              console.log('Added source:', {
                url,
                title: chunk.web.title,
                index: sourceMap.size
              });
            }
          }
        });

        // Second pass: add references to text based on groundingSupports
        let processedText = text;
        supports.forEach((support: any) => {
          const { segment, groundingChunkIndices } = support;
          if (segment && groundingChunkIndices && groundingChunkIndices.length > 0) {
            // Get unique sources for this segment
            const uniqueSources = new Set<number>();
            groundingChunkIndices.forEach((chunkIndex: number) => {
              const chunk = chunks[chunkIndex];
              if (chunk?.web?.uri) {
                const source = Array.from(sourceMap.values()).find(s => s.url === chunk.web.uri);
                if (source) {
                  uniqueSources.add(source.index);
                }
              }
            });

            if (uniqueSources.size > 0) {
              const sourceIndices = Array.from(uniqueSources).sort((a, b) => a - b);
              const referenceText = sourceIndices.map(index => `[${index}]`).join('');
              
              // Add reference at the end of the segment if it doesn't already have one
              const segmentText = segment.text;
              if (!segmentText.includes('[') && !segmentText.endsWith(']')) {
                processedText = processedText.replace(
                  segmentText,
                  `${segmentText} ${referenceText}`
                );
              }
            }
          }
        });

        text = processedText;
      }

      const sources = Array.from(sourceMap.values());
      console.log('Final sources:', sources);

      // Sort sources by index to maintain order
      sources.sort((a, b) => a.index - b.index);

      // Format the response text to proper markdown/HTML
      let formattedText = await formatResponseToMarkdown(text, sources);

      // Generate a session ID and store the chat
      const sessionId = Math.random().toString(36).substring(7);
      chatSessions.set(sessionId, chat);

      res.json({
        sessionId,
        summary: formattedText,
        sources,
      });
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(500).json({
        message:
          error.message || "An error occurred while processing your search",
      });
    }
  });

  // Follow-up endpoint - continues existing chat session
  app.post("/api/follow-up", async (req, res) => {
    try {
      const { sessionId, query } = req.body;

      if (!sessionId || !query) {
        return res.status(400).json({
          message: "Both sessionId and query are required",
        });
      }

      const chat = chatSessions.get(sessionId);
      if (!chat) {
        return res.status(404).json({
          message: "Chat session not found",
        });
      }

      // Send follow-up message in existing chat
      const result = await chat.sendMessage(`${query}

Please include numbered references to your sources in square brackets [1], [2], etc. at the end of relevant statements.`);
      const response = await result.response;
      console.log(
        "Raw Google API Follow-up Response:",
        JSON.stringify(
          {
            text: response.text(),
            candidates: response.candidates,
            groundingMetadata: response.candidates?.[0]?.groundingMetadata,
            parts: response.candidates?.[0]?.content?.parts,
          },
          null,
          2
        )
      );
      let text = response.text();

      // Extract sources from grounding metadata
      const sourceMap = new Map<
        string,
        { title: string; url: string; snippet: string; index: number }
      >();

      // Get grounding metadata from response
      const metadata = response.candidates?.[0]?.groundingMetadata as any;
      console.log('Extracted metadata:', JSON.stringify(metadata, null, 2));
      
      if (metadata) {
        const chunks = metadata.groundingChunks || [];
        const supports = metadata.groundingSupports || [];
        
        console.log('Processing chunks:', chunks.length);
        console.log('Processing supports:', supports.length);

        // First pass: collect all sources
        chunks.forEach((chunk: any, index: number) => {
          if (chunk.web?.uri && chunk.web?.title) {
            const url = chunk.web.uri;
            if (!sourceMap.has(url)) {
              // Find snippets that reference this chunk
              const snippets = supports
                .filter((support: any) =>
                  support.groundingChunkIndices.includes(index)
                )
                .map((support: any) => support.segment.text)
                .join(" ");

              sourceMap.set(url, {
                title: chunk.web.title,
                url: url,
                snippet: snippets || "",
                index: sourceMap.size + 1 // Add 1-based index
              });
              
              console.log('Added source:', {
                url,
                title: chunk.web.title,
                index: sourceMap.size
              });
            }
          }
        });

        // Second pass: add references to text based on groundingSupports
        let processedText = text;
        supports.forEach((support: any) => {
          const { segment, groundingChunkIndices } = support;
          if (segment && groundingChunkIndices && groundingChunkIndices.length > 0) {
            // Get unique sources for this segment
            const uniqueSources = new Set<number>();
            groundingChunkIndices.forEach((chunkIndex: number) => {
              const chunk = chunks[chunkIndex];
              if (chunk?.web?.uri) {
                const source = Array.from(sourceMap.values()).find(s => s.url === chunk.web.uri);
                if (source) {
                  uniqueSources.add(source.index);
                }
              }
            });

            if (uniqueSources.size > 0) {
              const sourceIndices = Array.from(uniqueSources).sort((a, b) => a - b);
              const referenceText = sourceIndices.map(index => `[${index}]`).join('');
              
              // Add reference at the end of the segment if it doesn't already have one
              const segmentText = segment.text;
              if (!segmentText.includes('[') && !segmentText.endsWith(']')) {
                processedText = processedText.replace(
                  segmentText,
                  `${segmentText} ${referenceText}`
                );
              }
            }
          }
        });

        text = processedText;
      }

      const sources = Array.from(sourceMap.values());
      console.log('Final sources:', sources);

      // Sort sources by index to maintain order
      sources.sort((a, b) => a.index - b.index);

      // Format the response text to proper markdown/HTML
      let formattedText = await formatResponseToMarkdown(text, sources);

      res.json({
        summary: formattedText,
        sources,
      });
    } catch (error: any) {
      console.error("Follow-up error:", error);
      res.status(500).json({
        message:
          error.message ||
          "An error occurred while processing your follow-up question",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
