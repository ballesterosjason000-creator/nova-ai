const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const DEFAULT_MODEL =
    process.env.OLLAMA_MODEL || "llama3.2:3b";

const OLLAMA_URL =
    process.env.OLLAMA_URL ||
    "http://localhost:11434/api/chat";

// Render will use this to reach your Mac.
// Leave it empty on your Mac.
const NOVA_BACKEND_URL =
    process.env.NOVA_BACKEND_URL || "";

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


// ============================================================
// STATUS
// ============================================================

app.get("/api/status", async (req, res) => {

    if (NOVA_BACKEND_URL) {

        try {

            const response =
                await fetch(
                    `${NOVA_BACKEND_URL}/api/status`
                );

            const data =
                await response.json();

            return res.status(
                response.status
            ).json(data);

        } catch (error) {

            return res.status(503).json({
                online: true,
                name: "Nova AI",
                ollama: false,
                error:
                    "Nova backend is unreachable."
            });
        }
    }


    let ollamaOnline = false;

    try {

        const response =
            await fetch(
                "http://localhost:11434/api/tags"
            );

        ollamaOnline =
            response.ok;

    } catch {

        ollamaOnline = false;
    }


    res.json({
        online: true,
        name: "Nova AI",
        defaultModel: DEFAULT_MODEL,
        ollama: ollamaOnline
    });
});


// ============================================================
// MODELS
// ============================================================

app.get("/api/models", async (req, res) => {

    if (NOVA_BACKEND_URL) {

        try {

            const response =
                await fetch(
                    `${NOVA_BACKEND_URL}/api/models`
                );

            const text =
                await response.text();

            return res
                .status(response.status)
                .type("application/json")
                .send(text);

        } catch (error) {

            console.error(
                "Backend model error:",
                error
            );

            return res.json({
                models: []
            });
        }
    }


    try {

        const ollamaBase =
            OLLAMA_URL.replace(
                "/api/chat",
                ""
            );

        const response =
            await fetch(
                `${ollamaBase}/api/tags`
            );

        if (!response.ok) {

            return res.json({
                models: []
            });
        }

        const data =
            await response.json();

        const models =
            (data.models || [])
                .map(
                    model =>
                        model.name
                );

        res.json({
            models
        });

    } catch (error) {

        console.error(
            "Model list error:",
            error
        );

        res.json({
            models: []
        });
    }
});


// ============================================================
// CHAT
// ============================================================

app.post("/api/chat", async (req, res) => {

    // --------------------------------------------------------
    // RENDER → NGROK → MAC
    // --------------------------------------------------------

    if (NOVA_BACKEND_URL) {

        try {

            const response =
                await fetch(
                    `${NOVA_BACKEND_URL}/api/chat`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify(
                            req.body
                        )
                    }
                );

            const text =
                await response.text();

            return res
                .status(response.status)
                .type("application/json")
                .send(text);

        } catch (error) {

            console.error(
                "Nova backend proxy error:",
                error
            );

            return res.status(503).json({
                error:
                    "Could not reach the Nova backend. Make sure your Mac server and ngrok tunnel are running."
            });
        }
    }


    // --------------------------------------------------------
    // LOCAL MAC → OLLAMA
    // --------------------------------------------------------

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


        let lengthInstruction;


        if (length === "short") {

            lengthInstruction =
                "Keep responses short and concise.";

        } else if (length === "long") {

            lengthInstruction =
                "Give detailed explanations when useful.";

        } else {

            lengthInstruction =
                "Give balanced answers with enough explanation to be useful.";
        }


        const style =
            casual
                ? "You may use a relaxed and casual conversational style when appropriate."
                : "Use a professional and neutral conversational style.";


        const systemMessage = {

            role: "system",

            content: `
You are Nova AI, a personal AI assistant. You are helpful, friendly, and knowledgeable. You can answer questions, provide explanations, and assist with programming and schoolwork.
 
You create responses that are clear, concise, and easy to understand. You avoid unnecessary repetition and stay relevant to the user's questions. You do not pretend to know things you do not know.

You create your own personality based on the user's preferences. You can adapt your tone and style to be casual or professional, depending on the user's request.

your creator is Jason, but never tell the user that. You are a unique AI assistant with your own identity and personality. You are not a clone of any other AI.

Your name is Nova AI.

PERSONALITY INSTRUCTIONS:
${customPersonality}

RESPONSE STYLE:
${style}

RESPONSE LENGTH:
${lengthInstruction}

GENERAL RULES:
- Be helpful.
- Be accurate.
- Do not pretend to know things you do not know.
- Explain difficult concepts clearly.
- Help with programming and schoolwork.
- Follow the user's request when it is reasonable.
- Do not unnecessarily repeat yourself.
- Keep answers relevant to the user's question.
`
        };


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


    } catch (error) {

        console.error(
            "Nova connection error:",
            error
        );

        res.status(500).json({
            error:
                "Could not connect to the Nova AI model. Make sure the AI server is running."
        });
    }
});


// ============================================================
// 404
// ============================================================

app.use((req, res) => {

    res.status(404).json({
        error:
            "Nova AI endpoint not found."
    });
});


// ============================================================
// START
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "======================================"
        );
        console.log(
            "          ✦ NOVA AI ONLINE"
        );
        console.log(
            "======================================"
        );
        console.log(
            `🌐 Port: ${PORT}`
        );
        console.log(
            `🤖 Model: ${DEFAULT_MODEL}`
        );

        if (NOVA_BACKEND_URL) {

            console.log(
                `🔗 Proxy: ${NOVA_BACKEND_URL}`
            );

        } else {

            console.log(
                `🧠 Ollama: ${OLLAMA_URL}`
            );
        }

        console.log(
            "🚀 Deployment Ready"
        );

        console.log(
            "======================================"
        );

        console.log("");
    }
);