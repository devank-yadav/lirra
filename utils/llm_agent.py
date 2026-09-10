import os
from dataclasses import dataclass
from typing import Optional

from anthropic import Anthropic
from openai import OpenAI


DEFAULT_OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
DEFAULT_ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest')


class LLMClientError(RuntimeError):
  """Raised when the LLM client cannot fulfil a request."""


@dataclass
class LLMConfig:
  provider: str = 'openai'
  openai_model: str = DEFAULT_OPENAI_MODEL
  anthropic_model: str = DEFAULT_ANTHROPIC_MODEL
  temperature: float = float(os.getenv('LLM_TEMPERATURE', '0.8'))
  max_tokens: int = int(os.getenv('LLM_MAX_TOKENS', '2048'))


class LLMClient:
  """Wrapper around OpenAI / Anthropic chat APIs."""

  def __init__(self, provider: str = 'openai', config: Optional[LLMConfig] = None):
    self.config = config or LLMConfig(provider=provider.lower())
    self.provider = self.config.provider

    if self.provider == 'openai':
      self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
      if not os.getenv('OPENAI_API_KEY'):
        raise LLMClientError('OPENAI_API_KEY is not set')
    elif self.provider in ('claude', 'anthropic'):
      self.provider = 'anthropic'
      self.client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
      if not os.getenv('ANTHROPIC_API_KEY'):
        raise LLMClientError('ANTHROPIC_API_KEY is not set')
    else:
      raise ValueError(f'Unsupported provider: {provider}')

  def generate_response(self, system_prompt: str, user_prompt: str) -> str:
    if self.provider == 'openai':
      return self._generate_openai(system_prompt, user_prompt)
    return self._generate_anthropic(system_prompt, user_prompt)

  def _generate_openai(self, system_prompt: str, user_prompt: str) -> str:
    try:
      response = self.client.chat.completions.create(
        model=self.config.openai_model,
        temperature=self.config.temperature,
        max_tokens=self.config.max_tokens,
        messages=[
          {'role': 'system', 'content': system_prompt},
          {'role': 'user', 'content': user_prompt},
        ],
      )
    except Exception as exc:
      raise LLMClientError(f'OpenAI request failed: {exc}') from exc

    try:
      return response.choices[0].message.content.strip()
    except (AttributeError, IndexError) as exc:
      raise LLMClientError('OpenAI returned an unexpected response payload') from exc

  def _generate_anthropic(self, system_prompt: str, user_prompt: str) -> str:
    try:
      response = self.client.messages.create(
        model=self.config.anthropic_model,
        system=system_prompt,
        max_tokens=self.config.max_tokens,
        temperature=self.config.temperature,
        messages=[
          {'role': 'user', 'content': user_prompt},
        ],
      )
    except Exception as exc:
      raise LLMClientError(f'Anthropic request failed: {exc}') from exc

    try:
      return ''.join(block.text for block in response.content if getattr(block, 'text', None)).strip()
    except AttributeError as exc:
      raise LLMClientError('Anthropic returned an unexpected response payload') from exc
