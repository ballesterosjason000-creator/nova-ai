const express = require("express");
const path = require("path");

const app = express();

const PORT = 3000;

const DEFAULT_MODEL = "llama3.2:3b";

const OLLAMA_URL =
    "http://localhost:11434/api/chat";


app.use(
    express.json({
        limit: "10mb"
    })
);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ==========================================
// STATUS
// ==========================================

app.get("/api/models", async (req, res) => {
    try {
        const response = await fetch(
            "http://localhost:11434/api/tags"
        );

        if (!response.ok) {
            return res.json({
                models: []
            });
        }

        const data = await response.json();

        const models = (data.models || []).map(
            model => model.name
        );

        res.json({
            models
        });
    } catch (error) {
        console.error("Model list error:", error);

        res.json({
            models: []
        });
    }
});


// ==========================================
// CHAT
// ==========================================

app.post(
    "/api/chat",
    async (req, res) => {

        try {

            const {
                messages,
                settings = {}
            } = req.body;


            if (
                !Array.isArray(messages) ||
                messages.length === 0
            ) {

                return res.status(400).json({
                    error:
                        "No messages provided."
                });

            }


            // =========================
            // SETTINGS
            // =========================

            const model =
                settings.model ||
                DEFAULT_MODEL;


            const temperature =
                typeof settings.temperature === "number"
                    ? settings.temperature
                    : 0.7;


            const length =
                settings.length ||
                "medium";


            const casual =
                settings.casual !== false;


            const customPersonality =
                settings.personality ||
                "Be friendly, helpful, smart, direct, and easy to understand.";


            // =========================
            // RESPONSE LENGTH
            // =========================

            let lengthInstruction = "";

            if (length === "short") {

                lengthInstruction =
                    "Keep responses short and concise.";

            }

            else if (length === "long") {

                lengthInstruction =
                    "Give detailed explanations when useful.";

            }

            else {

                lengthInstruction =
                    "Give balanced answers with enough explanation to be useful.";

            }


            // =========================
            // PERSONALITY
            // =========================

            const style =
                casual
                    ? "You may use a relaxed and casual conversational style when appropriate."
                    : "Use a professional and neutral conversational style.";


            const systemMessage = {

                role: "system",

                content: `
You are Nova AI, a personal AI assistant.

Your creator is Jason.

Your name is Nova AI.

Your creator is Jason.

PERSONALITY INSTRUCTIONS:
${customPersonality}

RESPONSE STYLE:
${style}

${lengthInstruction}

GENERAL RULES:
- Be helpful.
- Be accurate.
- Do not pretend to know things you do not know.
- Explain difficult concepts clearly.
- Help with programming and schoolwork.
- Follow the user's request when it is reasonable.
- Do not unnecessarily repeat yourself.
`
            };


            // =========================
            // OLLAMA
            // =========================

            const ollamaResponse =
                await fetch(
                    OLLAMA_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            model,

                            messages: [
                                systemMessage,
                                ...messages
                            ],

                            options: {

                                temperature

                            },

                            stream: false

                        })
                    }
                );


            if (!ollamaResponse.ok) {

                const errorText =
                    await ollamaResponse.text();

                console.error(
                    "Ollama error:",
                    errorText
                );


                return res.status(500).json({

                    error:
                        `Ollama could not use model "${model}". Make sure the model is installed.`

                });

            }


            const data =
                await ollamaResponse.json();


            const reply =
                data.message?.content ||
                "Nova did not return a response.";


            res.json({

                reply,

                model

            });

        }

        catch (error) {

            console.error(
                "Nova connection error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not connect to Ollama. Make sure Ollama is running."

            });

        }

    }
);


// ==========================================
// START
// ==========================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "================================"
        );

        console.log(
            "        ✦ NOVA AI ONLINE"
        );

        console.log(
            "================================"
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            `🤖 Default Model: ${DEFAULT_MODEL}`
        );

        console.log(
            "⚙️ Custom Settings: Enabled"
        );

        console.log(
            "🧠 Ollama: Connected"
        );

        console.log(
            "================================"
        );

        console.log("");

    }
);