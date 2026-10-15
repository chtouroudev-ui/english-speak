"""Talks to the local model through an OpenAI-compatible API or the native Ollama API."""
import json
import re

import httpx

TIMEOUT = httpx.Timeout(300.0, connect=10.0)


def _base(settings):
    return settings["llm_base_url"].rstrip("/")


def _headers(settings):
    h = {"Content-Type": "application/json"}
    if settings.get("llm_api_key"):
        h["Authorization"] = f"Bearer {settings['llm_api_key']}"
    return h


def _to_native(messages):
    """Convert OpenAI-style messages (with image_url parts) to Ollama's /api/chat format."""
    out = []
    for m in messages:
        if isinstance(m["content"], list):
            text = " ".join(p["text"] for p in m["content"] if p["type"] == "text")
            images = [
                p["image_url"]["url"].split(",", 1)[-1]
                for p in m["content"]
                if p["type"] == "image_url"
            ]
            out.append({"role": m["role"], "content": text, "images": images})
        else:
            out.append(m)
    return out


def with_image(text, image_data_url):
    if not image_data_url:
        return text
    return [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": image_data_url}},
    ]


def pick_model(settings, has_image):
    if has_image and settings.get("vision_model"):
        return settings["vision_model"]
    return settings["llm_model"]


async def stream_chat(settings, messages, model=None, temperature=0.7, max_tokens=None):
    """Yield text pieces as the model writes them."""
    model = model or settings["llm_model"]
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        if settings["llm_api"] == "ollama":
            body = {
                "model": model,
                "messages": _to_native(messages),
                "stream": True,
                "options": {"temperature": temperature},
            }
            if max_tokens:
                body["options"]["num_predict"] = max_tokens
            async with client.stream(
                "POST", f"{_base(settings)}/api/chat", json=body, headers=_headers(settings)
            ) as r:
                await _raise_for_status(r)
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    piece = data.get("message", {}).get("content", "")
                    if piece:
                        yield piece
                    if data.get("done"):
                        break
        else:
            body = {
                "model": model,
                "messages": messages,
                "stream": True,
                "temperature": temperature,
            }
            if max_tokens:
                body["max_tokens"] = max_tokens
            async with client.stream(
                "POST",
                f"{_base(settings)}/chat/completions",
                json=body,
                headers=_headers(settings),
            ) as r:
                await _raise_for_status(r)
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    data = json.loads(payload)
                    choices = data.get("choices") or [{}]
                    piece = (choices[0].get("delta") or {}).get("content") or ""
                    if piece:
                        yield piece


async def _raise_for_status(r):
    if r.status_code >= 400:
        body = (await r.aread()).decode(errors="replace")[:500]
        raise LLMError(f"Model server answered {r.status_code}: {body}")


class LLMError(Exception):
    pass


async def complete(settings, messages, model=None, temperature=0.3):
    parts = []
    async for p in stream_chat(settings, messages, model=model, temperature=temperature):
        parts.append(p)
    return "".join(parts).strip()


def parse_json(text):
    """Small models often wrap JSON in prose or code fences; pull out the first object."""
    text = re.sub(r"```(?:json)?", "", text)
    start = text.find("{")
    if start == -1:
        raise ValueError("no JSON object in model output")
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError("unfinished JSON object in model output")


async def complete_json(settings, messages, fallback, model=None):
    for _ in range(2):
        try:
            return parse_json(await complete(settings, messages, model=model, temperature=0.2))
        except (ValueError, json.JSONDecodeError):
            continue
    return fallback


async def list_models(settings):
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        if settings["llm_api"] == "ollama":
            r = await client.get(f"{_base(settings)}/api/tags", headers=_headers(settings))
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
        r = await client.get(f"{_base(settings)}/models", headers=_headers(settings))
        r.raise_for_status()
        return [m["id"] for m in r.json().get("data", [])]
