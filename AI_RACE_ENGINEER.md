# 🤖 AI Race Engineer Assistant

An LLM-powered race engineering assistant that provides real-time strategic advice during iRacing sessions.

## Features

✅ **Natural Language Interface** - Ask questions in plain English
✅ **Real-time Analysis** - Analyzes telemetry, fuel, tire, and strategy data
✅ **Concise Advice** - Professional race engineer communication style
✅ **Context-Aware** - Understands your race situation
✅ **Conversation History** - Maintains context across questions
✅ **Quick Suggestions** - Contextual quick-ask buttons
✅ **Self-Hosted** - AI runs on your backend server via Ollama, no cloud API needed

## Quick Start

**Note**: Ollama runs on the **backend server**, not on the user's machine. The AI processing happens server-side.

### Option 1: Docker (Easiest)

**Start Ollama as a Docker container:**

```bash
# Start Ollama service
docker-compose up -d ollama

# The container will automatically pull the default model (llama3.1:8b)
# Wait for it to finish (watch the logs)
docker-compose logs -f ollama-setup
```

**Change the model:**
```bash
# Use a lighter model
OLLAMA_MODEL=phi3:mini docker-compose up -d ollama ollama-setup

# Or a more powerful model
OLLAMA_MODEL=llama3.1:70b docker-compose up -d ollama ollama-setup
```

**GPU Acceleration (if you have NVIDIA GPU):**
1. Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. Uncomment the GPU section in `docker-compose.yml`
3. Restart: `docker-compose up -d ollama`

### Option 2: Automated Local Setup

From the project root, run:

```bash
pnpm setup-ai
```

This interactive script will:
1. Detect your OS and install Ollama if needed
2. Start the Ollama service
3. Let you choose which model to download (llama3.1:8b or phi3:mini)
4. Verify everything is working

### Option 3: Manual Local Setup

**1. Install Ollama on the backend server:**

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [ollama.ai/download](https://ollama.ai/download)

**2. Pull a Model (on backend server):**

```bash
# Fast, good quality (4GB RAM)
ollama pull llama3.1:8b

# Or lighter model (2GB RAM)
ollama pull phi3:mini

# Or best quality (requires 16GB+ RAM)
ollama pull llama3.1:70b
```

**3. Start Ollama (on backend server):**

```bash
ollama serve
```

Leave this running in a terminal window on the backend server.

### Start the Application

```bash
# Terminal 1: Backend
pnpm --filter @iracing-race-engineer/api dev

# Terminal 2: Frontend
pnpm --filter @iracing-race-engineer/web dev
```

When the backend starts, you'll see:
- ✅ `AI Race Engineer ready with 1 model(s): llama3.1:8b` - Success!
- ⚠️  `AI Race Engineer unavailable - Ollama not running` - Need to start Ollama

### Use the AI

Open the app and scroll to the **"AI Race Engineer"** section at the bottom.

## Example Conversations

### General Status
**You:** How am I doing?
**AI:** P3, 2.5s behind leader. Fuel good for 18 laps. Tires at 87% health. Push hard, you're in a good window.

### Fuel Strategy
**You:** Should I pit for fuel now?
**AI:** Negative. Current fuel gets you to lap 42. Pit window opens lap 38. Box then for 12L and you're home.

### Tire Management
**You:** Are my tires still good?
**AI:** Tires dropping fast - 2.8% per lap. Health at 68%. Change on next stop, lap 25 latest.

### Undercut Opportunities
**You:** Any undercut opportunities?
**AI:** Yes! Gap to P2 is 3.1s. Box lap 18, fresh tires will gain you 2s. Undercut window is tight but doable.

### Race Tactics
**You:** What should I focus on?
**AI:** Manage fuel - you're using 2.8L/lap, target 2.5L. Lap traffic coming in 3 laps. Attack mode now before they slow you.

## How It Works

### Architecture

```
Frontend (Browser)
    ↓
Backend API (/api/race-engineer/advice)
    ↓
RaceEngineerLLM Service
    ↓
Ollama (running on backend server)
    ↓
LLM Model (llama3.1:8b, etc.)
```

### Backend Service (`race-engineer-llm.ts`)

The `RaceEngineerLLM` class:
1. **Builds Context** from telemetry and strategy data
2. **Maintains Conversation** history for context
3. **Uses System Prompt** to enforce race engineer persona
4. **Calls Ollama API** on the backend server (no internet needed)
5. **Returns Concise Advice** (2-3 sentences max)

### API Endpoints

- **POST `/api/race-engineer/advice`**: Get race engineering advice
- **GET `/api/race-engineer/status`**: Check if Ollama is available
- **POST `/api/race-engineer/reset`**: Clear conversation history

### System Prompt

The AI is instructed to:
- ✅ Be a professional race engineer
- ✅ Communicate fast, clear, and actionable
- ✅ Use racing terminology
- ✅ Keep responses to 2-3 sentences
- ✅ Start with critical info first
- ✅ Include specific numbers
- ✅ End with clear actions

### Data Flow

```
User Question (Frontend)
        ↓
POST /api/race-engineer/advice
        ↓
Backend receives: { question, telemetry, strategy }
        ↓
RaceEngineerLLM builds context
        ↓
Ollama API call (localhost:11434)
        ↓
LLM generates advice
        ↓
Backend returns: { advice }
        ↓
Frontend displays response
```

## Model Recommendations

| Model | RAM | Speed | Quality | Best For |
|-------|-----|-------|---------|----------|
| `phi3:mini` | 2GB | ⚡⚡⚡ | ⭐⭐ | Low-end hardware |
| `llama3.1:8b` | 4GB | ⚡⚡ | ⭐⭐⭐ | **Recommended** |
| `mistral:7b` | 4GB | ⚡⚡ | ⭐⭐⭐ | Good alternative |
| `llama3.1:70b` | 16GB+ | ⚡ | ⭐⭐⭐⭐⭐ | High-end hardware |

## Configuration

### Change Model

Edit `apps/api/src/services/ai/race-engineer-llm.ts`:

```typescript
constructor(
  baseUrl: string = 'http://localhost:11434',
  model: string = 'llama3.1:8b'  // ← Change this
) {
```

### Adjust Response Length

```typescript
options: {
  temperature: 0.7,
  top_p: 0.9,
  num_predict: 150,  // ← Increase for longer responses
}
```

### Change Personality

Edit the `buildSystemPrompt()` method to customize the AI's personality and response style.

## Troubleshooting

### "AI Race Engineer offline"

**Check backend API is running:**
```bash
curl http://localhost:3001/api/race-engineer/status
```

Should return `{"available": true, "models": [...]}`.

**Check Ollama is running on backend server:**
```bash
curl http://localhost:11434/api/tags
```

Should return a list of models.

**Restart Ollama (on backend server):**
```bash
pkill ollama && ollama serve
```

**Restart backend API:**
```bash
pnpm --filter @iracing-race-engineer/api dev
```

### Slow Responses

- Use a smaller model (`phi3:mini`)
- Enable GPU acceleration (Ollama does this automatically if available)
- Reduce `num_predict` in the code

### "Race engineer unavailable"

Backend API not running or can't connect to Ollama.

**Check logs:**
```bash
# Backend logs will show Ollama connection attempts
pnpm --filter @iracing-race-engineer/api dev
```

## Advanced Features

### Periodic Updates

The AI can provide automatic updates every 5 laps or when critical situations occur:

```typescript
const update = await raceEngineer.getPeriodicUpdate(context);
```

### Voice Integration (Future)

Could integrate with:
- Browser Speech Synthesis API
- Elevenlabs for natural voices
- Text-to-speech for real race engineer experience

### Multi-Language Support

Add language parameter to system prompt for non-English races.

## Privacy & Performance

✅ **100% Local** - No data sent to cloud services, runs on your backend server
✅ **No Internet Required** - Works offline (Ollama runs locally on backend)
✅ **No API Costs** - Free forever, no OpenAI/Claude API needed
✅ **Fast** - ~500ms response time on good hardware
✅ **Secure** - Your race data stays within your infrastructure
✅ **Self-Hosted** - Full control over the AI model and data

## Resources

- [Ollama Documentation](https://ollama.ai/docs)
- [Llama 3.1 Model Card](https://ollama.ai/library/llama3.1)
- [Model Comparison](https://ollama.ai/library)

---

**Built with** ❤️ for sim racers who want a competitive edge!
