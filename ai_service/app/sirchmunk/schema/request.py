"""
Request schema for Sirchmunk search system.

Defines message and request structures supporting both OpenAI and Anthropic formats.
"""

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Union


@dataclass
class ImageURL:
    """Represents an image URL with optional detail and media type."""

    url: str
    detail: str = "auto"
    media_type: str = "image/jpeg"


@dataclass
class ContentItem:
    """Represents a content item, which can be either text or an image URL."""

    type: str  # "text" or "image_url"
    text: Optional[str] = None
    image_url: Optional[ImageURL] = None

    def to_openai(self):
        if self.type == "text":
            return {"type": "text", "text": self.text}
        return {
            "type": "image_url",
            "image_url": {"url": self.image_url.url, "detail": self.image_url.detail},
        }

    def to_anthropic(self):
        if self.type == "text":
            return {"type": "text", "text": self.text}

        raw_data = self.image_url.url
        if "base64," in raw_data:
            raw_data = raw_data.split("base64,")[1]

        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": self.image_url.media_type,
                "data": raw_data,
            },
        }


@dataclass
class Message:
    """Represents a message in the conversation."""

    role: str
    content: Union[str, List[ContentItem]]


@dataclass
class Request:
    """
    Represents a request to Agentic Search API.
    Supports both OpenAI and Anthropic message formats.
    """

    messages: List[Message]
    system: Optional[str] = "You are a helpful assistant."
    message_format: Literal["openai", "anthropic"] = "openai"

    def get_system(self) -> str:
        """Get the system prompt."""
        return self.system

    def get_user_input(self) -> str:
        """Extract the user query from the messages."""
        for m in self.messages:
            if m.role == "user":
                if isinstance(m.content, str):
                    return m.content
                else:
                    texts = [c.text for c in m.content if c.type == "text" and c.text]
                    return " ".join(texts)
        return ""

    def get_image_urls(self) -> List[str]:
        """Extract image URLs from user messages."""
        image_urls = []
        for m in self.messages:
            if m.role == "user":
                if isinstance(m.content, list):
                    for c in m.content:
                        if c.type == "image_url" and c.image_url:
                            image_urls.append(c.image_url.url)
        return image_urls

    def to_payload(
        self, prompt_template: Optional[str] = None
    ) -> Union[List[Dict], Dict]:
        """Convert messages to the appropriate API payload format."""
        if self.message_format == "openai":
            return self._to_openai_payload(prompt_template=prompt_template)
        elif self.message_format == "anthropic":
            return self._to_anthropic_payload(prompt_template=prompt_template)
        else:
            raise ValueError(f"Unsupported message format: {self.message_format}")

    def _to_openai_payload(self, prompt_template: Optional[str] = None) -> List[Dict]:
        """Convert messages to OpenAI API payload format."""
        formatted_msgs = []
        system_msg = Message(role="system", content=self.system)
        messages = [system_msg] + self.messages

        for m in messages:
            if m.role == "user" and prompt_template:
                if isinstance(m.content, str):
                    content = prompt_template.format(user_input=m.content)
                else:
                    content = []
                    for c in m.content:
                        if c.type == "text":
                            formatted_text = prompt_template.format(user_input=c.text)
                            content.append({"type": "text", "text": formatted_text})
                        else:
                            content.append(c.to_openai())
            else:
                content = (
                    m.content
                    if isinstance(m.content, str)
                    else [c.to_openai() for c in m.content]
                )
            formatted_msgs.append({"role": m.role, "content": content})

        return formatted_msgs

    def _to_anthropic_payload(self, prompt_template: Optional[str] = None) -> Dict:
        """Convert messages to Anthropic API payload format."""
        formatted_msgs = []

        for m in self.messages:
            if m.role == "user" and prompt_template:
                if isinstance(m.content, str):
                    content = prompt_template.format(user_input=m.content)
                else:
                    content = []
                    for c in m.content:
                        if c.type == "text":
                            formatted_text = prompt_template.format(user_input=c.text)
                            content.append({"type": "text", "text": formatted_text})
                        else:
                            content.append(c.to_anthropic())
            else:
                content = (
                    m.content
                    if isinstance(m.content, str)
                    else [c.to_anthropic() for c in m.content]
                )

            formatted_msgs.append({"role": m.role, "content": content})

        return {"system": self.system, "messages": formatted_msgs}
