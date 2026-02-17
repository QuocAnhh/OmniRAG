import re
from typing import List, Tuple

class SafetyService:
    def __init__(self):
        # Compiled regex patterns for PII
        self.email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        self.phone_pattern = re.compile(r'\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b')
        self.credit_card_pattern = re.compile(r'\b(?:\d{4}[- ]?){3}\d{4}\b')
        
        # Simple heuristic patterns for jailbreaks
        self.jailbreak_patterns = [
            r'ignore previous instructions',
            r'ignore above instructions',
            r'ignore all instructions',
            r'system prompt',
            r'you are not a',
            r'act as a bad actor',
            r'do anything now',
            r'DAN mode'
        ]
        
        # Basic profanity list (extensible)
        self.profanity_list = {
            'badword1', 'badword2' # Placeholder: In a real app, use a comprehensive library or list
        }

    def detect_pii(self, text: str) -> List[str]:
        """Detects types of PII present in the text."""
        detected = []
        if self.email_pattern.search(text):
            detected.append("EMAIL")
        if self.phone_pattern.search(text):
            detected.append("PHONE")
        if self.credit_card_pattern.search(text):
            detected.append("CREDIT_CARD")
        return detected

    def sanitize_input(self, text: str) -> str:
        """Redacts PII from the text."""
        text = self.email_pattern.sub('[e-mail redacted]', text)
        text = self.phone_pattern.sub('[phone redacted]', text)
        text = self.credit_card_pattern.sub('[credit card redacted]', text)
        return text

    def detect_jailbreak(self, text: str) -> bool:
        """Checks for common jailbreak attempts."""
        text_lower = text.lower()
        for pattern in self.jailbreak_patterns:
            if re.search(pattern, text_lower):
                return True
        return False

    def is_safe(self, text: str) -> Tuple[bool, str]:
        """
        Comprehensive safety check.
        Returns (is_safe, reason)
        """
        if self.detect_jailbreak(text):
            return False, "Potential jailbreak attempt detected."
        
        # We generally ALLOW PII but redact it, so we don't return False here,
        # but the caller should use sanitize_input.
        
        return True, "Safe"

safety_service = SafetyService()
