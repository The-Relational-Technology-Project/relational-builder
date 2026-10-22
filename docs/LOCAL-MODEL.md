# Local Model (Ollama) — running the Builder on a model you host

Relational Builder can build with a model running on your own computer, or on
a box in the room, instead of a cloud provider. No API key, no account, and it
keeps working when the cloud providers don't. This is the "Local model
(Ollama)" preset in **Settings → On your computer or network**.

It is the first half of the builder/runtime split in the human-scale brief
(`docs/human-scale/`, when that branch lands): the model that helps *write* an
app. The model a built app calls at *runtime* is a separate, later piece.

## Honest expectations

A model that fits on one machine (7B to 32B parameters) is good at edits,
fixes, and simple single-file tools. It will not match Claude Opus on a full
multi-file build. Treat local mode as the sovereign, outage-proof backstop,
not a swap-in for the default. The bench (`bench/`) is how we'll say more
than that with evidence; see "Benchmarking" below.

## On your own laptop (five minutes)

1. Install [Ollama](https://ollama.com) and pull one coder model:
   ```sh
   ollama pull qwen2.5-coder:7b      # ~4.7 GB, runs on 8 GB of RAM
   ollama pull qwen2.5-coder:14b     # ~9 GB, noticeably better; 16 GB of RAM
   ollama pull qwen3-coder:30b       # ~19 GB, the strongest that fits a 32 GB Mac
   ```
2. If you use the hosted Builder (relationalbuilder.org), tell Ollama to accept
   calls from it, then restart Ollama:
   ```sh
   # macOS
   launchctl setenv OLLAMA_ORIGINS "https://relationalbuilder.org"
   # Linux / anywhere else
   OLLAMA_ORIGINS="https://relationalbuilder.org" ollama serve
   ```
   Browsers let an https page call `http://localhost`, so this is the only step
   the hosted Builder needs. Running the Builder locally (`npm run dev`) needs
   no CORS change at all: Ollama allows localhost origins out of the box.
3. In the Builder: Settings → On your computer or network → **Check**. It
   should say "Connected" and list the models you pulled. Press **Use**. The
   model picker in the composer now shows your installed models.

LM Studio (`http://localhost:1234`), llama.cpp's server (`http://localhost:8080`),
and vLLM all speak the same protocol. Change the address and press Check.

## A shared box in a room (the social club setup)

One machine serves a workshop over the venue wifi. Pre-pull models before the
session; you cannot download 20 GB during an outage.

- **Hardware that works:** a Mac Studio or MacBook Pro with 32 GB or more of
  unified memory, or a Linux box with a 24 GB GPU. Pull two or three models,
  not seven; curation beats count.
- **Expose Ollama on the network:** `OLLAMA_HOST=0.0.0.0 ollama serve`.
- **Mixed content is the catch.** The hosted Builder is https, and browsers
  refuse to let an https page call `http://192.168.x.x`. Two ways around it:
  1. *Serve the Builder from the same box.* `npm run build && npx vite preview --host`
     and attendees open `http://<box-ip>:4173`. Plain http to plain http, no
     browser objection, and the room is fully off the cloud. Set
     `OLLAMA_ORIGINS="http://<box-ip>:4173"` so Ollama accepts the calls.
  2. *Put https in front of the model server* (a Caddy or Tailscale Serve
     line). Then the hosted Builder can call it directly.
- Attendees set the address in Settings to the box, press Check, press Use.

## Benchmarking local models

`bench/models.ts` already carries open-model entries (Qwen3 Coder, DeepSeek,
Llama via Together). To bench the exact models a box would run, add an entry
with `providerId: 'local'` pointing at the Ollama model id and run the bench
against a machine with the models pulled. Results go in `bench/results/` in
the usual format, flattering or not.

## What's in the code

- `createLocalProvider()` in `src/providers/openai-compatible.ts`: id `local`,
  keyless, default `http://localhost:11434`, a curated default model list that
  the endpoint's real installed list replaces once reachable.
- `registry.setBaseUrl` / `getBaseUrl`; the store persists `baseUrls` and
  restores them on load. The local endpoint is only probed once someone has
  chosen it or set its address, so nobody else's console fills with refused
  connections.
- `LocalModelRow` in `src/components/ProviderSettings.tsx`: address, Check,
  and a plain-language reason when a check fails (mixed content, CORS, not
  running).
