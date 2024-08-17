import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Constants
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

// Initialize Express app
const app = express();

// Middleware
app.use(bodyParser.json());

// Type Definitions
type ContentPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
};

type Content = {
  parts: ContentPart[];
};

// Routes
app.get("/v1/models", async (req: Request, res: Response) => {
  try {
    const models = await getGeminiModels();
    const modelNames = models.models.map((model: { name: string }) =>
      model.name.replace("models/", "")
    );
    res.json(modelNames);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ message: "Failed to fetch Gemini models" });
  }
});

app.post("/v1/chat/completions", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const response = await generateGeminiResponse(data);
    res.json(response);
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ message: "Failed to generate response" });
  }
});

// Generate Gemini response
async function generateGeminiResponse(data: any) {
  const model = data.model || "gemini-1.5-flash";
  const prompt = data.prompt || "No prompt provided";
  const mimeType = data.mimeType || "text/plain";
  const inlineData = data.inlineData;

  const contents: Content[] = [
    {
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  if (inlineData) {
    contents[0].parts.push({
      inline_data: {
        mime_type: mimeType,
        data: Buffer.from(inlineData).toString("base64"),
      },
    });
  }

  const geminiResponse = await getGeminiTextGeneration(model, contents);

  // Transform the Gemini API response to match the desired output format
  const transformedResponse = {
    id: `chatcmpl-${generateUniqueId()}`, // Generate a unique ID for the completion
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000), // Current timestamp in seconds
    model: model,
    choices: geminiResponse.candidates.map((candidate: any, index: number) => ({
      index: index,
      message: {
        role: "assistant",
        content: candidate.content.parts.map((part: any) => part.text).join(""),
        refusal: null, // Assuming no refusal in this context
      },
      logprobs: null, // Assuming no logprobs available
      finish_reason: candidate.finishReason.toLowerCase(), // Map finishReason to the expected format
    })),
    usage: {
      prompt_tokens: geminiResponse.usageMetadata.promptTokenCount,
      completion_tokens: geminiResponse.usageMetadata.candidatesTokenCount,
      total_tokens: geminiResponse.usageMetadata.totalTokenCount,
    },
    system_fingerprint: "fp_3aa7262c27", // Example fingerprint, replace with actual if available
  };

  return transformedResponse;
}

// Get Gemini text generation
async function getGeminiTextGeneration(model: string, contents: Content[]) {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY environment variable is not set");
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
      { contents },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error generating text:", error);
    throw new Error("Failed to generate text");
  }
}

// Get Gemini models
async function getGeminiModels() {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY environment variable is not set");
  }

  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching models:", error);
    throw new Error("Failed to fetch Gemini models");
  }
}

// Helper function to generate a unique ID
function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

// Start server
function startServer() {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
